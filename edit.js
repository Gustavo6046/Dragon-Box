selectedTile = 0;
document.getElementById('tileSelected').innerHTML = "0 (0)";

down = false;
moving = false;

function mouseOverTile(evt)
{
    let x = Math.floor((evt.clientX - document.getElementById('palette').getBoundingClientRect().left) / 16);
    let y = Math.floor((evt.clientY - document.getElementById('palette').getBoundingClientRect().top) / 16);
    
    document.getElementById('tileX').innerHTML = x;
    document.getElementById('tileY').innerHTML = y;
    document.getElementById('tileIndex').innerHTML = (y * 16 + x) + " (" + (y * 16 + x).toString(16).toUpperCase() + ")";
}

function pickTile(evt)
{
    let x = Math.floor((evt.clientX - document.getElementById('palette').getBoundingClientRect().left) / 16);
    let y = Math.floor((evt.clientY - document.getElementById('palette').getBoundingClientRect().top) / 16);
    
    document.getElementById('tileSelected').innerHTML = (y * 16 + x) + " (" + (y * 16 + x).toString(16).toUpperCase() + ")";
    
    selectedTile = (y * 16 + x);
}

function canvasMouseUp(evt)
{   
    if ( !moving )
    {
        console.log("setting tile");
        
        let x = Math.floor(((evt.clientX - document.getElementById('palette').getBoundingClientRect().left) / 32 - display.pan[0]) / computeZoom());
        let y = Math.floor(((evt.clientY - document.getElementById('palette').getBoundingClientRect().top) / 32 - display.pan[1]) / computeZoom());
        
        if ( x > context.tilemap.width || x < context.tilemap.width || y > context.tilemap.height || y < context.tilemap.height ) return;
        
        context.tilemap.tiles[parseInt(document.getElementById("drawLayer").value)][y * context.tilemap.width + x] = selectedTile;
        render_main();
    }
    
    down = moving = false;
}

function canvasMouseDown(evt)
{   
    down = true;
    
    let x = (evt.clientY - document.getElementById('palette').getBoundingClientRect().top);
    let y = (evt.clientY - document.getElementById('palette').getBoundingClientRect().top);
    
    lastPlace = [x, y];
}

function zoom(evt)
{
    setZoomTag("editorWheelZoom", getZoomTag("editorWheelZoom") + evt.deltaY);
    render_main();
}

function mouseOverCanvas(evt)
{
    moving = down;
    
    if ( down )
    {
        let x = (evt.clientY - document.getElementById('palette').getBoundingClientRect().top);
        let y = (evt.clientY - document.getElementById('palette').getBoundingClientRect().top);
        
        display.pan[0] += (x - lastPlace[0]) / 32;
        display.pan[1] += (y - lastPlace[1]) / 32;
        
        render_main();
        
        lastPlace = [x, y];
    }
}

function newMap()
{
    let width = document.getElementById('mapW').value;
    let height = document.getElementById('mapH').value;
    
    context.tilemap = createTilemap(width, height);
}

context.tilemap = createTilemap(16, 16);