input = [];
input.panSpeed = 38;
input.zoomSpeed = 1.75;

lastTime = Date.now();

display = {
    background: [0, 0, 0],
    zoom: [],
    pan: [0, 0],
    tile_size: 32,
    tileset: "assets/tileset.png",
    tileImages: [],
    tilesetImage: null
};

context = {
    tilemap: null,
    entities: [],
    frozen: false
};

showCollision = false;

loadedSprites = {};
entityTypes = {};

function call(e, name) {
    if ( e.functions[name] == null )
    {
        console.log(e.type.name + " has no function " + name + "!");
        return;
    }
    
    let args = [e];
    
    for ( let ind = 2; ind < Array.from(arguments).length; ind++ )
        args.push(Array.from(arguments)[ind]);
    
    try
    {
        return e.functions[name].apply(args[0], args);
    }
    
    catch ( err ) 
    {
        console.log("Error at: " + e.type.name + "." + name);
        throw err;
    }
}

function spawnEntity(type, x, y, angle)
{
    if ( angle == null ) angle = 0;
    
    if ( entityTypes[type] == null ) return null;
    
    let entity = {
        x: x,
        y: y,
        angle: 0,
        type: entityTypes[type],
        props: JSON.parse(JSON.stringify(entityTypes[type].defaultProps)),
        functions: {},
        sprite: null,
        index: context.entities.length
    };
    
    for ( let k = 0; k < Object.keys(entityTypes[type].functions).length; k++ )
    {
        name = Object.keys(entityTypes[type].functions)[k];
        
        if ( entityTypes[type].functions[name] != null )
            entity.functions[name] = entityTypes[type].functions[name].bind(entity);
    }
    
    if ( Object.keys(entity.functions).indexOf("init") > -1 )
        call(entity, 'init', Date.now() / 1000);
    
    context.entities.push(entity);
    return entity;
}

function entityType(url, onFinish)
{
    return new Promise(function(resolveType, reject) {
        let req = new XMLHttpRequest();
        req.open("GET", url, true);
        req.responseType = "xml";
        
        req.onload = function() {
            let parser = new DOMParser();
            let xmlDoc = parser.parseFromString(req.responseText, "text/xml");
            
            let root = xmlDoc.documentElement;
            let name = root.getAttribute('classname');
            
            let superType = root.getAttribute("inherit");
            
            let props = {};
            let functions = {};
            
            let pm = [];
            
            for ( let index = 0; index < root.childNodes.length; index++ )
            {    
                let el = root.childNodes[index];
                
                if ( el.nodeName === 'requirement' && el.getAttribute("classname") != null && entityTypes[el.getAttribute('classname')] == null )
                    pm.push(entityType(el.textContent));
            }
            
            function finishUp() {
                if ( superType != null && entityTypes[superType] != null )
                {
                    props = JSON.parse(JSON.stringify(entityTypes[superType].defaultProps));                    
                    
                    for ( let fn = 0; fn < Object.keys(entityTypes[superType].functions).length; fn++ )
                    {
                        let key = Object.keys(entityTypes[superType].functions)[fn];
                        
                        if ( functions[key] == null ) // allow overriding
                            functions[key] = entityTypes[superType].functions[key].bind(null);
                    }
                }
                
                for ( let index = 0; index < root.childNodes.length; index++ )
                {
                    let el = root.childNodes[index];
                    
                    if ( el.nodeName === 'properties' )
                        for ( let pind = 0; pind < el.childNodes.length; pind++ )
                        {
                            let prop = el.childNodes[pind];
                            
                            if ( prop.nodeName === 'prop' && prop.getAttribute('key') != null )
                                props[prop.getAttribute('key')] = eval(prop.textContent);
                        }
                        
                    else if ( el.nodeName == 'function' && el.getAttribute('name') != null )
                    {
                        try
                        {
                            functions[el.getAttribute('name')] = eval(el.textContent + ";\n" + el.getAttribute('name'));
                        }
                        
                        catch ( err )
                        {
                            console.log("Error in function: " + name + "." + el.getAttribute('name'));
                            throw err;
                        }
                    }
                }
                
                let etype = {
                    name: name,
                    functions: functions,
                    defaultProps: props
                };
                
                entityTypes[name] = etype;
                
                if ( onFinish != null )
                    onFinish(etype);
                
                resolveType(etype);
            }
            
            if ( pm.length < 1 )
                finishUp();
            
            else
                Promise.all(pm).then(finishUp);
        };
        
        req.send(null);
    });
}

mainCanvas = document.getElementById('canvas');

if ( mainCanvas != null )
{
    mainCtx = mainCanvas.getContext('2d');
    mainCtx.mozImageSmoothingEnabled = false;
    mainCtx.webkitImageSmoothingEnabled = false;
    mainCtx.msImageSmoothingEnabled = false;
    mainCtx.imageSmoothingEnabled = false;
}

/*
tilemap specification: {
    width: width in tiles,
    height: height in tiles,
    tiles: layer list [
        0: Floor layer (byte array of tile indexes)
        1: Mat layer (byte array of tile indexes)
        3: Solid layer (byte array of tile indexes)
        2: Semisolid layer (byte array of tile indexes)
        2: Non-solid layer (byte array of tile indexes)
    ]
}
*/

function addPan(x, y)
{
    if ( y == null ) // assuming x is a single array input
    {
        y = x[1];
        x = x[0];
    }
    
    display.pan[0] += x;
    display.pan[1] += y;
}

function setPan(x, y)
{
    if ( y == null ) // assuming x is a single array input
    {
        y = x[1];
        x = x[0];
    }
    
    display.pan[0] = x;
    display.pan[1] = y;
}

function addZoomTag(name, amount)
{
    for ( let i = 0; i < display.zoom.length; i++ )
        if ( display.zoom[i].tag == name )
        {
            display.zoom[i].amount += amount;
            return display.zoom[i];
        }
        
    display.zoom.push({
       tag: name,
       amount: amount
    });
    
    return display.zoom.slice(-1)[0];
}

function mulZoomTag(name, amount)
{
    for ( let i = 0; i < display.zoom.length; i++ )
        if ( display.zoom[i].tag == name )
        {
            display.zoom[i].amount *= amount;
            // console.log(amount);
            return display.zoom[i];
        }
        
    display.zoom.push({
       tag: name,
       amount: amount
    });
    
    return display.zoom.slice(-1)[0];
}

function setZoomTag(name, amount)
{
    for ( let i = 0; i < display.zoom.length; i++ )
        if ( display.zoom[i].tag == name )
        {
            display.zoom[i].amount = amount;
            return display.zoom[i];
        }
        
    display.zoom.push({
       tag: name,
       amount: amount
    });
    
    render_main();
    
    return display.zoom.slice(-1)[0];
}

function getZoomTag(name)
{
    for ( let i = 0; i < display.zoom.length; i++ )
        if ( display.zoom[i].tag == name )
            return display.zoom[i];
       
    return 1;
}

function delZoomTag(name)
{
    let bad = 0;
    
    for ( let i = 0; i < display.zoom.length; i++ )
        if ( display.zoom[i - bad].tag == name )
        {
            display.zoom.splice(i - bad, 1);
            bad += 1;
        }
        
    render_main();
       
    return bad > 0;
}

function computeZoom()
{
    let zoom = 1;
    
    for ( let i = 0; i < display.zoom.length; i++ )
        if ( display.zoom[i].amount !== NaN )
            zoom *= display.zoom[i].amount;
        
    if ( zoom < 0.05 )
        zoom = 0.05;
    
    if ( zoom > 32 )
        zoom = 32;
    
    return zoom
};

function rgbToString(rgb)
{
    return "rgb(" + rgb[0] * 255 + ", " + rgb[1] * 255 + ", " + rgb[2] * 255 + ")";
}

function getSprite(url)
{
    return new Promise(function(resolve, reject) {
        let img = new Image();
        
        img.onload = function() {
            resolve(img);
        }
        img.src = url;
    });
}

function getTile(tileset, index, onFinish)
{
    let tsize = display.tile_size;
    var tileset_image = null;
    
    function crop()
    {
        let twidth = tileset_image.width / tsize;
        let theight = tileset_image.height / tsize;
        let canvas = document.createElement('canvas');
        let ctx = canvas.getContext("2d");
        
        if ( index > twidth * theight - 1 )
            return;
        
        // document.body.appendChild(canvas);
        canvas.width = canvas.height = canvas.style.width = canvas.style.height = display.tile_size;
        ctx.drawImage(tileset_image, -(index % twidth) * display.tile_size, -Math.floor(index / twidth) * display.tile_size);
        
        if ( onFinish )
            onFinish(ctx.getImageData(0, 0, display.tile_size, display.tile_size));
    }
    
    if ( display.tilesetImage == null )
    {
        tileset_image = new Image();
        
        tileset_image.src = tileset;
        tileset_image.onload = function() {
            display.tilesetImage = tileset_image;
            crop();
        };
    }
    
    else
    {
        tileset_image = display.tilesetImage;
        crop();
    }
}

function createTilemap(width, height)
{
    return {
        width: width,
        height: height,
        tiles: [0, 0, 0, 0, 0].fill(new Uint8Array(width * height))
    };
}

function loadTilemap(url, onFinish, onError)
{
    let req = new XMLHttpRequest();
    req.open("GET", url, true);
    req.responseType = "blob";
    
    req.onload = function() {
        let blob = req.response;
        
        if ( blob )
        {
            let reader = new FileReader();
        
            reader.addEventListener('loadend', function() {
                let buffer = reader.result;
                
                let header = new Uint16Array(buffer.slice(0, 4));
            
                let width = header[0];
                let height = header[1];
                
                let body = new Uint8Array(buffer).slice(4);
                
                if ( body.length != width * height * 5 )
                {
                    if ( onError )
                        onError("MAPDATAERR", "Invalid tilemap data: expected five " + width + "x" + height + " (area " + width * height + ") layers, or volume " + width * height * 5 + "; got volume " + body.length);
                    
                    return;
                }
                
                let res = createTilemap(width, height);
                let tArea = width * height;
                
                for ( let i = 0; i < 5; i++ )
                    res.tiles[i] = body.slice(i * tArea, (i + 1) * tArea);
                
                onFinish(res);
            })
        
            reader.readAsArrayBuffer(blob);
        }
        
        else if ( onError )
            onError("NETERR", "No response found in XMLHttpRequest for the tilemap's url: " + url);
    }
    
    req.send(null);
}

function render_layer(width, height, tileLayer, preRender)
{
    var pm = [];
    
    for ( let i = 0; i < width * height; i++ )
    {   
        if (
            ((i % width - display.pan[0]) * computeZoom() * display.tile_size) < -display.tile_size * computeZoom()
            || ((Math.floor(i / width) - display.pan[1]) * computeZoom() * display.tile_size) < -display.tile_size * computeZoom()
        )
            continue;
            
        pm.push(new Promise(function(resolve, reject) {
            if ( display.tileImages.length < tileLayer[i] - 1 || display.tileImages[tileLayer[i]] == null )
            {    
                getTile(display.tileset, tileLayer[i], function(data) {
                    let scaleCanvas = document.createElement('canvas');
                    let scaleCtx = scaleCanvas.getContext('2d');
                                
                    scaleCanvas.width = display.tile_size;
                    scaleCanvas.height = display.tile_size;
                    scaleCtx.putImageData(data, 0, 0);
                    
                    function useCanvas(c)
                    {
                        let img = new Image();
                        // document.body.appendChild(img);
                        
                        img.onload = function() {
                            if ( preRender )
                                preRender();
                            
                            mainCtx.drawImage(img,
                                ((i % width - display.pan[0]) * computeZoom() * display.tile_size), // position X
                                ((Math.floor(i / width) - display.pan[1]) * computeZoom() * display.tile_size), // position Y
                                computeZoom() * display.tile_size, computeZoom() * display.tile_size // scale X & Y
                            );
                            
                            // console.log(
                            //     ((i % width - display.pan[0]) * computeZoom() * display.tile_size), // position X
                            //     ((Math.floor(i / width) - display.pan[1]) * computeZoom() * display.tile_size), // position Y
                            // );
                            display.tileImages[tileLayer[i]] = img;
                        }
                        
                        img.src = c.toDataURL();
                    }
                    
                    useCanvas(scaleCanvas);
                });
            }
            
            else
            {
                mainCtx.drawImage(display.tileImages[tileLayer[i]],
                    ((i % width - display.pan[0]) * computeZoom() * display.tile_size), // position X
                    ((Math.floor(i / width) - display.pan[1]) * computeZoom() * display.tile_size), // position Y
                    computeZoom() * display.tile_size, computeZoom() * display.tile_size // scale X & Y
                );
            }
        }));
    }
    
    return Promise.all(pm);
}

function drawSprite(entity, spriteImage)
{
    mainCtx.save();
    mainCtx.translate(
        (entity.x - display.pan[0]) * computeZoom() * display.tile_size, // position X
        (entity.y - display.pan[1]) * computeZoom() * display.tile_size  // position Y
    );
    mainCtx.translate(computeZoom() * spriteImage.width / 2, computeZoom() * spriteImage.height / 2);
    mainCtx.rotate(-entity.angle);
    
    mainCtx.drawImage(spriteImage,
        computeZoom() * spriteImage.width / -2, computeZoom() * spriteImage.height / -2, // position X & T
        computeZoom() * spriteImage.width, computeZoom() * spriteImage.height // scale X & Y
    );
        
    if ( showCollision && entity.props.radius != null && entity.props.radius > 0 )
    {
        mainCtx.strokeStyle = "rgba(0, 255, 0, 145)";
        mainCtx.strokeWidth = 4;
        mainCtx.beginPath();
        mainCtx.arc(
            computeZoom() * spriteImage.width / -2 + computeZoom() * spriteImage.width / 2, computeZoom() * spriteImage.height / -2 + computeZoom() * spriteImage.height / 2, // position X & T
            entity.props.radius * display.tile_size * computeZoom(), 0, 2 * Math.PI
        );
        mainCtx.stroke();
        
        mainCtx.strokeStyle = "rgba(0, 255, 0, 145)";
        mainCtx.strokeWidth = 5;
        mainCtx.beginPath();
        mainCtx.moveTo(0, 0);
        mainCtx.lineTo(entity.props.radius + computeZoom() * spriteImage.width / 2, 0);
        mainCtx.stroke();
        
        mainCtx.restore();
        
        mainCtx.font = (15 * computeZoom()) + "px Verdana";
        mainCtx.fillStyle = "rgba(0, 255, 255, 170)";
        mainCtx.fillText(entity.index.toString(),
            (entity.x - display.pan[0]) * computeZoom() * display.tile_size, // position X
            (entity.y - display.pan[1]) * computeZoom() * display.tile_size // position Y
        )
    }
    
    // revert transformations
    else
        mainCtx.restore();
}

function render_entities(onFinish)
{
    var pm = [];
    
    for ( let i = 0; i < context.entities.length; i++ )
    {   
        let ent = context.entities[i];
        let spriteName = ent.sprite;
        
        if ( spriteName == null )
            continue;
        
        pm.push(new Promise(function(resolve, reject) {
            if ( loadedSprites[spriteName] == null )
                getSprite("assets/sprites/" + spriteName + ".png").then(function(sprite) {
                    loadedSprites[spriteName] = sprite;
                    drawSprite(ent, sprite);
                });
                
            else
                drawSprite(ent, loadedSprites[spriteName]);
        }));
    }
    
    let pa = Promise.all(pm);
    
    if ( onFinish != null )
        onFinish();
    
    return pa;
}

function keyPress(code)
{
    if ( code == 'KeyF' )
        context.frozen = !context.frozen;
    
    if ( code == 'KeyC' && input.indexOf("ShiftLeft") > -1 )
        showCollision = !showCollision;
}

function render_tilemap(map, onFinish)
{
    var notrend = true;
    var prom = [];
    
    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
    
    for ( let index = 0; index < 5; index++ )
    { 
        prom.push(render_layer(map.width, map.height, map.tiles[index], null,
            function() {
                if ( done == map.width * map.height * 5 )
                    onFinish();
                
                else
                {
                    index++;
                }
            }
        ));
    }
    
    let plast = prom.reduce(function (p1, p2) { p1.then(p2); return p2; });
    onFinish();
}

function render_main(onFinish)
{    
    if ( context.tilemap != null )
        render_tilemap(context.tilemap, function() {
            render_entities(onFinish);
        });
}

function tick()
{   
    let deltaTime = (Date.now() - lastTime) / 1000;
    
    mainCanvas.width = mainCanvas.getBoundingClientRect().right - mainCanvas.getBoundingClientRect().left;
    mainCanvas.height = mainCanvas.getBoundingClientRect().bottom - mainCanvas.getBoundingClientRect().top;
    
    if ( !context.frozen )
        for ( let index = 0; index < context.entities.length; index++ )
            if ( context.entities[index].functions.tick != null )
                call(context.entities[index], 'tick', deltaTime);
    
    if ( input.indexOf("ArrowLeft") > -1 )
        addPan(-deltaTime * input.panSpeed / computeZoom(), 0);
    
    if ( input.indexOf("ArrowRight") > -1 )
        addPan(deltaTime * input.panSpeed / computeZoom(), 0);
    
    if ( input.indexOf("ArrowUp") > -1 )
        addPan(0, -deltaTime * input.panSpeed / computeZoom());
    
    if ( input.indexOf("ArrowDown") > -1 )
        addPan(0, deltaTime * input.panSpeed / computeZoom());
    
    if ( input.indexOf("PageUp") > -1 )
        mulZoomTag("clientZoom",  1 / (1 + (deltaTime * input.zoomSpeed)), 2.3);
    
    if ( input.indexOf("PageDown") > -1 )
        mulZoomTag("clientZoom", (1 + (deltaTime * input.zoomSpeed)), 2.3);
    
    render_main(function() { lastTime = Date.now(); });
}

function canvasClick(cx, cy, tx, ty)
{
    for ( let ind = 0; ind < context.entities.length; ind++ )
    {
        let e = context.entities[ind];
    
        if ( e.functions.clicked != null && e.props.clickRadius != null && e.props.clickRadius >= Math.sqrt(Math.pow(tx - e.x, 2) + Math.pow(ty - e.y, 2)) )
            call(e, 'clicked', tx, ty);
    }
}

function initialize(mapName, onFinish)
{    
    loadTilemap(mapName,
        function(map) {
            context.entities = [];
            context.tilemap = map;
            
            render_main(onFinish);
        },
        function(err, log) {
            console.log(err + ": " + log);
        }
    );
}