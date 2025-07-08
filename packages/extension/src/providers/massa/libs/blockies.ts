// Blockies implementation for Massa addresses
// Based on Ethereum's blockies but adapted for Massa addresses

const randseed = new Array(4); // Xorshift: [x, y, z, w] 32 bit values

function seedrand(seed: string) {
  console.log('🔵 [BLOCKIES] Seeding random with:', seed);
  for (let i = 0; i < randseed.length; i++) {
    randseed[i] = 0;
  }
  for (let j = 0; j < seed.length; j++) {
    randseed[j % 4] =
      (randseed[j % 4] << 5) - randseed[j % 4] + seed.charCodeAt(j);
  }
  console.log('🔵 [BLOCKIES] Random seed values:', randseed);
}

function rand(): number {
  // Xorshift algorithm
  const t = randseed[0] ^ (randseed[0] << 11);
  randseed[0] = randseed[1];
  randseed[1] = randseed[2];
  randseed[2] = randseed[3];
  randseed[3] = randseed[3] ^ (randseed[3] >> 19) ^ t ^ (t >> 8);
  return (randseed[3] >>> 0) / ((1 << 31) >>> 0);
}

function createColor(): string {
  // Create a bright, saturated color
  const h = Math.floor(rand() * 360);
  const s = (rand() * 60) + 40; // 40-100% saturation
  const l = (rand() * 25) + 25; // 25-50% lightness
  console.log('🔵 [BLOCKIES] Generated color - H:', h, 'S:', s, 'L:', l);
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function createImageData(size: number): number[] {
  console.log('🔵 [BLOCKIES] Creating image data for size:', size);
  const width = size; // Only support square icons for now
  const height = size;

  const dataWidth = Math.ceil(width / 2);
  const mirrorWidth = width - dataWidth;

  const data = [];
  for (let y = 0; y < height; y++) {
    let row = [];
    for (let x = 0; x < dataWidth; x++) {
      // this makes foreground and background color to have a 43% (1/2.3) probability
      // spot color has 13% chance
      row[x] = Math.floor(rand() * 2.3);
    }
    const r = row.slice(0, mirrorWidth);
    r.reverse();
    row = row.concat(r);

    for (let i = 0; i < row.length; i++) {
      data.push(row[i]);
    }
  }
  
  console.log('🔵 [BLOCKIES] Generated image data length:', data.length);
  console.log('🔵 [BLOCKIES] Sample data:', data.slice(0, 10));
  return data;
}

function createSVG(
  imageData: number[],
  color: string,
  scale: number,
  bgcolor: string,
  spotcolor: string,
): string {
  const width = Math.sqrt(imageData.length);
  console.log('🔵 [BLOCKIES] Creating SVG - width:', width, 'scale:', scale);
  console.log('🔵 [BLOCKIES] Colors - fg:', color, 'bg:', bgcolor, 'spot:', spotcolor);
  
  const svgSize = width * scale;
  let svg = `<svg width="${svgSize}" height="${svgSize}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect width="${svgSize}" height="${svgSize}" fill="${bgcolor}"/>`;

  for (let i = 0; i < imageData.length; i++) {
    const row = Math.floor(i / width);
    const col = i % width;
    const fillColor = imageData[i] === 1 ? color : imageData[i] === 2 ? spotcolor : null;
    
    if (fillColor) {
      svg += `<rect x="${col * scale}" y="${row * scale}" width="${scale}" height="${scale}" fill="${fillColor}"/>`;
    }
  }

  svg += '</svg>';
  console.log('🔵 [BLOCKIES] Generated SVG length:', svg.length);
  return svg;
}

interface Options {
  size?: number;
  scale?: number;
  color?: string;
  bgcolor?: string;
  spotcolor?: string;
}

export default function createIcon(address: string, opts?: Options): string {
  try {
    console.log('🔵 [BLOCKIES] === Creating icon for address ===');
    console.log('🔵 [BLOCKIES] Address:', address);
    console.log('🔵 [BLOCKIES] Options:', opts);
    
    if (!address || typeof address !== 'string') {
      throw new Error('Invalid address provided');
    }
    
    opts = opts || {};
    const size = opts.size || 8;
    const scale = opts.scale || 4;
    const seed = address.toLowerCase();
    
    console.log('🔵 [BLOCKIES] Final params - size:', size, 'scale:', scale, 'seed:', seed);
    
    seedrand(seed);
    const color = opts.color || createColor();
    const bgcolor = opts.bgcolor || createColor();
    const spotcolor = opts.spotcolor || createColor();
    
    console.log('🔵 [BLOCKIES] Final colors - fg:', color, 'bg:', bgcolor, 'spot:', spotcolor);
    
    const imageData = createImageData(size);
    const svg = createSVG(imageData, color, scale, bgcolor, spotcolor);
    
    // Convert to base64 data URL
    let base64;
    if (typeof btoa !== 'undefined') {
      base64 = btoa(svg);
    } else {
      // Fallback for environments where btoa is not available
      base64 = Buffer.from(svg, 'utf8').toString('base64');
    }
    
    const dataUrl = `data:image/svg+xml;base64,${base64}`;
    console.log('🔵 [BLOCKIES] Generated data URL length:', dataUrl.length);
    console.log('🔵 [BLOCKIES] === Icon creation complete ===');
    
    return dataUrl;
  } catch (error) {
    console.error('❌ [BLOCKIES] Error creating Massa identicon:', error);
    // Return a default icon - a simple colorful square with pattern
    const defaultSvg = `<svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" fill="#E0E7FF"/>
      <rect x="8" y="8" width="16" height="16" fill="#6366F1"/>
      <rect x="12" y="12" width="8" height="8" fill="#A5B4FC"/>
    </svg>`;
    let defaultBase64;
    if (typeof btoa !== 'undefined') {
      defaultBase64 = btoa(defaultSvg);
    } else {
      defaultBase64 = Buffer.from(defaultSvg, 'utf8').toString('base64');
    }
    return `data:image/svg+xml;base64,${defaultBase64}`;
  }
} 