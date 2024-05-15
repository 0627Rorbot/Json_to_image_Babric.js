const puppeteer = require('puppeteer');
const express = require('express');
const fs = require("fs");
const path = require("path");
const cors = require('cors');
const axios = require('axios');
const opentype = require('opentype.js');
const bodyParser = require('body-parser');

const app = express();

app.use(cors(['*']));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

app.get('/', async function (req, res) {
  res.send('works');
});

app.get('/test', async function (req, res) {
  res.end('test');
});

app.get('/image-proxy', async (req, res) => {
  var imageUrl = req.query.url;

  if (!imageUrl) {
    return res.status(400).send('No image URL provided');
  }

  try {
    var response = await axios({
      method: 'GET',
      url: imageUrl,
      responseType: 'stream'
    });

    res.setHeader('Content-Type', response.headers['content-type']);
    response.data.pipe(res);
  } catch (error) {
    console.error('Error fetching image:', error);
    res.status(500).send('Error fetching image');
  }
});

app.get('/generateimage', async function (req, res) {
  var short_tags;
  var product_fields;
  var test_template;

  const allowedOrigins = ['http://app.tidy.shopping', 'http://tidy.shopping', 'https://app.tidy.shopping', 'https://tidy.shopping', '*'];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  // additional headers
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  try {
    if (!req.body.template_json || req.body.template_json.trim() === "") {
      // return res.status(500).send('');
    }
    function generateDocument() {
      return new Promise((resolve, reject) => {
        var document_1 = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
          `;
        var document_2 = ``;
        var document_3 = `
              </style>
            </head>
            <body>
              <canvas id="c"></canvas>
                <h1>Hello world!</h1>
            </body>
          </html>        
          `;
        if (test_template.fontLists) {
          test_template.fontLists.forEach((el) => {
            if (el.ttf_base64 != '' && el.ttf_base64 != null) {

              const charArray = el.ttf_base64.split('').map(function (char) {
                return char.charCodeAt(0);
              });
              const uint8Array = new Uint8Array(charArray);
              const fontBuffer = uint8Array.buffer;
              const fontBase64 = btoa(el.ttf_base64);
              const fontDataURL = `data:font/ttf;base64,${fontBase64}`;
              const font = opentype.parse(fontBuffer);
              var fontName = font.names.fontFamily.en;
              document_2 += `
                  @font-face {
                    font-family: ${fontName};
                    src: url(${fontDataURL});
                  }          
                `
            }
          });
        }
        var document = document_1 + document_2 + document_3;
        resolve(document);
      });
    }

    function changeTags(jsonFile, tags, product_fields) {
      var obj = jsonFile.objects.map((item) => {
        if (item.type == "group") {
          // Iterate over each object in item.objects
          item.objects.forEach((subItem) => {
            // Perform replacements only if subItem.text exists
            if (subItem.text && (subItem.type == "i-text" || subItem.type == "text")) {
              subItem.textAlign = "center";
              // subItem.originX = "center";
              // subItem.originY = "middle";
              //subItem.fontSize = "center";
              // Replace tags with corresponding product_fields values
              tags.forEach((el) => {
                if (subItem.text.includes('[' + el + ']') && product_fields[el]) {
                  subItem.text = subItem.text.replace(new RegExp('\\[' + el + '\\]', 'g'), product_fields[el]);
                }
              });
              // Remove any remaining unreplaced tags using regex
              subItem.text = subItem.text.replace(/\[[^\]]+\]/g, '');
              //  console.log(subItem);
            }
          });
        }
        return item;
      });

      jsonFile.objects = obj;
      return jsonFile;
    }

    function isValidUrl(string) {
      let url;
      try {
        url = new URL(string);
      } catch (_) {
        return false;
      }
      return url.protocol === "http:" || url.protocol === "https:";
    }

    function getTestTemplate() {
      return new Promise((resolve, reject) => {
        fs.readFile('./test_template_3.json', 'utf8', (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(JSON.parse(data));
          }
        });
      });
    }

    function centerTextInGroup(group) {
      group.forEachObject((obj) => {
        if (obj.type === 'i-text' || obj.type === 'text') {
          // Ensure dimensions are updated
          obj.setCoords();
          let boundingRect = obj.getBoundingRect(true); // Get accurate bounding box

          // Calculate new position to center the text
          obj.left = (group.width / 2) - (boundingRect.width / 2) + group.left;
          obj.top = (group.height / 2) - (boundingRect.height / 2) + group.top;

          // Reapply coordinates to take new positioning into account
          obj.setCoords();
        }
      });

      // Render all to reflect changes
      group.canvas.renderAll();
    }

    /* Initiate the product fields */

    product_fields = {
      "image_link_1": "https://www.bman.ro/cdn/shop/files/13d_c836beff-4197-4a2f-9257-ad6a4c56e034.jpg?v=1703669418",
      "title": "Mohammad",
      "id": "productid8",
      "brand": "BMAN",
      "channel": "channel8",
      "price": "129 RON",
      "sale_price": "129 RON",
      "avablility": "avablility8",
      "additional_image_link_first": "https://static-de.starshiners.com/files/photos/108027/689573.jpg",
      "additional_image_link_1": "https://www.bman.ro/cdn/shop/files/13b_0afe7161-6166-4e12-9299-047947c01fae.jpg?v=1703669418",
      "additional_image_link_2": "https://www.bman.ro/cdn/shop/files/13b_0afe7161-6166-4e12-9299-047947c01fae.jpg?v=1703669418",
    }

    if (Object.keys(product_fields).length === 0) {
      short_tags = [];
    } else {
      short_tags = Object.keys(product_fields);
    }

    test_template = await getTestTemplate();
    test_template.background.source = '';
    var temp = await changeTags(test_template, short_tags, product_fields);

    const browser = await puppeteer.launch({
      headless: 'new', // Use Headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Add sandboxing arguments
    });

    const page = await browser.newPage();
    await page.setContent(await generateDocument());

    // Inject Fabric.js into the page
    //await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js' });

    const localScriptPath = path.join(__dirname, 'fabric.min.js');
    await page.addScriptTag({ path: localScriptPath });

    const imgUrl = await page.evaluate(async (test_template, product_fields) => {
      try {
        return new Promise((resolve) => {
          var canvasClone = new fabric.Canvas('c', {
            fireRightClick: true,
            stopContextMenu: true,
            controlsAboveOverlay: true,
          });

          canvasClone.loadFromJSON(test_template, async () => {
            canvasClone.setBackgroundColor('yellow');
            canvasClone.getObjects('group').map((group, i) => {
              let longText = group.texthandle;
              group.getObjects().map((obj, i) => {
                if (obj && (obj.type === 'i-text' || obj.type === 'text')) {
                  let textContent = obj.text;
                  // obj.set('text', textContent);
                  let method = longText;
                  if (method == "linebreak") {
                    let textLines = textContent.match(/.{1,24}/g);

                    textLines.forEach((line, index) => {
                      textLines[index] = ' ' + line;

                      if (index !== textLines.length - 1) {
                        textLines[index] += ' ';
                      }
                    });

                    obj.set('text', textLines.join('\n'));
                    // obj.set('textAlign', "center");
                    obj.set('textAlign', obj.textAlign);
                  }
                  else if (method == "shorten") {
                    let maxCharactersPerLine = 24;

                    let truncatedText = textContent.substring(0, maxCharactersPerLine);

                    obj.set('text', truncatedText);
                    obj.set('textAlign', obj.textAlign);
                  } else if (method == "automatic") {
                    obj.set('text', textContent);
                    let rectangleWidth = 800;

                    let maxWidth = rectangleWidth * 0.8;
                    let fontSize = 40;

                    obj.set('fontSize', fontSize);

                    let textWidth = obj.getBoundingRect().width;

                    while (textWidth > maxWidth && fontSize > 0) {
                      fontSize--;
                      obj.set('fontSize', fontSize);
                      textWidth = obj.getBoundingRect().width;
                    }

                    obj.set('textAlign', obj.textAlign);
                  }
                  // obj.set({
                  //   left: 0,
                  //   originX: 'left',
                  //   top: 0,
                  //   originY: 'top'
                  // });
                  /**
                   * Main error 
                   */
                  // obj.setCoords();//error1
                  //  if (method=="linebreak"){
                  //   obj.set({
                  //      backgroundColor: '#d60000',
                  //   });
                  //  }
                  // obj.setCoords();//error2
                }
              });

              var geek = new fabric.Text('GeeksforGeeks', {
                textAlign: 'left'
              });

              // geek.left = (geek.width * i);
              geek.left = group.left + (group.width / 2) - (geek.width / 2);
              group.addWithUpdate(geek);
            });

            canvasClone.renderAll();
            // add extra image 
            var product_extra_image = canvasClone.getObjects().filter((el, index) => {
              if (el.customType == 'background_image') {
                el.image_link = `http://127.0.0.1/image-proxy?url=${encodeURIComponent(el.src)}`;

              }
              if (el.customType == "extra_product" || el.customType == "image_link") {
                var keys = Object.keys(product_fields);
                keys.forEach(arg => {
                  if (arg == el.item_name) {
                    //el.image_link = product_fields[el.item_name]
                    el.image_link = `http://127.0.0.1/image-proxy?url=${encodeURIComponent(product_fields[el.item_name])}`;
                    return;
                  }
                });
                el.index = index;
                return el;
              }
            });
            /*
            const productImage = canvasClone.getObjects().find((item,index) => {
              if(item.customType === "image_link"){
                item.index = index;
                item.image_link = product_fields.image_link;
                return item;
              }
            }); 
            */
            // console.log(product_extra_image);
            const product_images = product_extra_image;
            var promises = product_images.map(async obj => {
              if (obj.image_link === undefined) {
                canvasClone.remove(obj);
                canvasClone.renderAll();
              }
              else {
                return new Promise((resolve, reject) => {
                  var index = obj.index;
                  var removeBg;
                  if (obj.bgState === "trimBgImage") {
                    removeBg = new Promise(async (resolve, reject) => {
                      fabric.Image.fromURL(obj.image_link, (final_product_image) => {
                        try {
                          // Calculate the scale to cover the wrapper area
                          const scaleWidth = obj.width / final_product_image.width;
                          const scaleHeight = obj.height / final_product_image.height;
                          const scale = Math.max(scaleWidth, scaleHeight);
                          // Scale the image
                          final_product_image.scale(scale);
                          // Center the image within the wrapper
                          const centeredLeft = obj.left + (obj.width - final_product_image.getScaledWidth()) / 2;
                          const centeredTop = obj.top + (obj.height - final_product_image.getScaledHeight()) / 2;
                          final_product_image.set({
                            left: centeredLeft,
                            top: centeredTop,
                            originX: 'left',
                            originY: 'top'
                          });
                          // Create a clipping rectangle that matches the wrapper dimensions
                          // The clipPath is relative to the canvas
                          var clipRect = new fabric.Rect({
                            originX: 'left',
                            originY: 'top',
                            left: obj.left,
                            top: obj.top,
                            width: obj.width,
                            height: obj.height,
                            absolutePositioned: true
                          });

                          // Apply the clip path to the image
                          final_product_image.clipPath = clipRect;
                          var originalIndex = canvasClone.getObjects().indexOf(obj);
                          canvasClone.insertAt(final_product_image, originalIndex);
                          resolve();
                        } catch (error) {
                          reject(error);
                        }
                      }, { crossOrigin: 'anonymous' });
                    });
                  }

                  else {
                    removeBg = new Promise((resolve) => {
                      resolve();
                    });
                  }

                  removeBg.then(() => {
                    var product_index = obj.index;
                    fabric.Image.fromURL(obj.image_link, async (final_product_image) => {
                      final_product_image._element.crossOrigin = 'Anonymous';

                      // Calculate the scale to fit the image within the wrapper without exceeding its original size
                      const scaleToFitWrapper = Math.min(obj.width / final_product_image.width, obj.height / final_product_image.height, 1);

                      var visible = obj.visible;

                      if (obj.bgState === "trimBgImage") {
                        canvasClone.remove(obj);
                      }
                      else {
                        // Apply the calculated scale
                        final_product_image.set({
                          scaleX: scaleToFitWrapper,
                          scaleY: scaleToFitWrapper,
                          layerShowPeriod: obj.layerShowPeriod,
                          id: obj.id,
                          visible: visible,
                          angle: obj.angle,
                          item_name: "final_product_image",
                          flipX: obj.flipX,
                          flipY: obj.flipY
                        }).setCoords();

                        var clipRect = new fabric.Rect({
                          originX: 'left',
                          originY: 'top',
                          left: obj.left,
                          top: obj.top,
                          width: obj.width,
                          height: obj.height,
                          absolutePositioned: true
                        });
                        final_product_image.clipPath = clipRect;

                        final_product_image.setPositionByOrigin(new fabric.Point(obj.left + obj.width * obj.scaleX / 2, obj.top + obj.height * obj.scaleX / 2))

                        //Check image position in the wrapper.
                        var final_product_image_left = final_product_image.left;
                        var final_product_image_top = final_product_image.top;

                        if (obj.position.positionX == "right") {
                          final_product_image_left = final_product_image.left + (final_product_image.left - obj.left);
                        }
                        if (obj.position.positionX == "left") {
                          final_product_image_left = final_product_image.left - (final_product_image.left - obj.left);
                        }

                        if (obj.position.positionY == "top") {
                          final_product_image_top = final_product_image.top - (final_product_image.top - obj.top);
                        }
                        if (obj.position.positionY == "bottom") {
                          final_product_image_top = final_product_image.top + (final_product_image.top - obj.top);
                        }
                        final_product_image.set({
                          left: final_product_image_left,
                          top: final_product_image_top
                        }).setCoords();
                        canvasClone.remove(obj);
                        canvasClone.add(final_product_image);
                        for (var i = 0; i < canvasClone.getObjects().length - product_index - 1; i++) {
                          final_product_image.sendBackwards();
                        }
                      }
                      resolve();
                    });
                  });
                })
              }
            });
            Promise.all(promises).then(response => {
              var cloneJson = canvasClone.toJSON(['id', 'bgState', 'originPoistion', 'fontLists', 'strokeLabel', 'ttf_base64', 'fontFamilyList', 'name', 'texthandle', 'scaling', 'item_name', 'position', 'layerShowPeriod', 'customType', 'gradientAngle', 'selectable', 'hasControls', "fillState", "borderState"])
              var jsonFile = JSON.stringify(cloneJson);
              canvasClone.loadFromJSON(jsonFile, async () => {
                canvasClone.renderAll.bind(canvasClone);

                const workspace = canvasClone.getObjects().find((item) => item.id === 'workspace');
                const { left, top, width, height } = workspace;
                const dataURL = canvasClone.toDataURL({
                  format: 'png',
                  quality: 0.8,
                  left,
                  top,
                  width,
                  height,
                });

                var oldViewport = canvasClone.viewportTransform;
                canvasClone.setViewportTransform([1, 0, 0, 1, 0, 0]);
                canvasClone.setViewportTransform(oldViewport);
                canvasClone.requestRenderAll();

                //   // Convert the data URL to binary 
                const base64Data = dataURL.replace(/^data:image\/png;base64,/, "");

                resolve(base64Data); // Resolve the promise with the base64 data  
              });

            });
          });
        });
      } catch (e) {
        console.error('Error inside page.evaluate:', e);
        throw e; // Rethrow to catch it outside of evaluate
      }
    }, test_template, product_fields);

    // Convert the base64 data to a buffer
    const imgBuffer = Buffer.from(imgUrl, 'base64');
    await browser.close();
    // Set the correct headers and send the image
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': imgBuffer.length
    });

    res.end(imgBuffer);
  } catch (error) {

    // await browser.close();
    res.status(500).send('');
    console.error('An error occurred:', error);
  }
});

app.listen(80, function () {
  console.log('listening on 80');
});
