const request = require("request");
const cheerio = require("cheerio");
const url = require('url');
const fs = require('fs');

// get the base url from a full url (i.e - from http://walla.co.il:80/aa/bb/cc?gg=tt we will extract http://walla.co.il:80)
function getBaseUrl(fullUrl) {
  const parsedUrl = url.parse(fullUrl);
  let baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
  if (parsedUrl.port) {
    baseUrl += `:${parsedUrl.port}`;
  }

  return baseUrl;
}

// if we are dealting with a relative path in the link - we will add it the baseurl
function transformsRelativePath(relativePath, baseUrl) {
  if (relativePath && (!relativePath.startsWith("http") || !relativePath.startsWith("https"))) {
    var tranformed = new URL(relativePath, baseUrl).href
    if (tranformed == relativePath) {
      return null
    } else
      return tranformed
    }
    else {
      return relativePath;
  }
}

// gets an html object and extracts all the links in it
function extractLinks($, baseUrl) {
  const links = []
  $("a").each((i, elem) => {
    var transformed = transformsRelativePath($(elem).attr("href"), baseUrl);
    if (transformed) {
      links.push(transformed);
    }
  });
  
  return Array.from(new Set(links));
}

// gets an html object and extracts all the images in it
function extractImages($, sourceUrl, depth) {
  const images = []
  $("img").each((i, elem) => {
    let src = $(elem).attr("src");
    images.push({
        imageUrl: src,
        sourceUrl: sourceUrl,
        depth: depth 
      }
    );
  });

  return images;
}

// gets the content of the url - this request is heavy, so we are using the async/away mechanism
async function getHTML(url) {
  return new Promise((resolve, reject) => {
    request({url: url, timeout: 1000}, (error, response, html) => {
      if (!error && response.statusCode == 200) {
        resolve(html);
      } else {
        reject(error);
      }
    });
  });
}

// this is the main function - recursive. will iterate on all the links and will extract the images from each of the links
async function workOnLink(fullUrl, imagesAggregator, depth, visited, maxDepth){
  try {
    
    if (depth > maxDepth || !fullUrl || visited.includes(fullUrl)) {
      return ;
    }

    visited.push(fullUrl);

    const baseUrl = getBaseUrl(fullUrl);

    const html = await getHTML(fullUrl);
    const $ = cheerio.load(html);

    const links = extractLinks($, baseUrl);
    const images = extractImages($, fullUrl, depth);

    imagesAggregator.push(...images);

    const tasks = []
    for (const link of links) {
      tasks.push(workOnLink(link, imagesAggregator, depth +1, visited, maxDepth));
    }

    await Promise.all(tasks);
  }
  catch (error) {
    console.error("Error processing: '" + fullUrl + "', erorr: " + error);
  }
}

async function main() {
  // User Params
  const fullUrl = process.argv[2]
  const maxDepth = parseInt(process.argv[3])

  const images = [] // this is the images aggregator
  await workOnLink(fullUrl, images, 0, [], maxDepth); //main function

  // prints the result and writes it to a file
  console.log(JSON.stringify(images, null, 4));
  fs.writeFile("images.json", JSON.stringify(images, null, 4), 'utf8', function (err) {
    if (err) {
        console.log("An error occured while writing JSON Object to File.");
        return console.log(err);
    }
 
    console.log("JSON file has been saved.");
});
}

main();

