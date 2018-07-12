import csv
import sys
import struct

res = b''

with open(sys.argv[1]) as csvfile:
    reader = list(csv.reader(csvfile))
    
    width, height = map(lambda x: int(x.strip(' ')), reader[0])
    res += struct.pack('=2H', width, height)
    
    temp = b''
    layer = 0
    layers = ['Floor', 'Mat', 'Solid', 'Semisolid', "Nonsolid"]
    
    for row in reader[2:]:
        if len(row) == 0:
            if len(temp) == 0:
                continue
        
            if len(temp) != width * height:
                raise ValueError("Layer {} has invalid area: {} instead of {}!".format(layers[layer], len(temp), width * height))
        
            res += temp
            layer += 1
            temp = b''
            continue
    
        else:
            for tile in row:
                temp += struct.pack('=B', int(tile.strip(' ')))
                
    if len(temp) > 0:
        if len(temp) != width * height:
            raise ValueError("Layer {} has invalid area: {} instead of {}!".format(layers[layer], len(temp), width * height))
         
        res += temp
        layer += 1
        
    with open(sys.argv[2], 'wb') as outfile:
        outfile.write(res)