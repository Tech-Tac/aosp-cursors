import { rm, mkdir, readdir, symlink, exists, copyFile } from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";
import { transform } from "vector-drawable-svg";
import { $ } from "bun";

const themeName       = "AOSP Cursors";
const themeIdentifier = "aosp-cursors";

const sizes        = [18, 24, 30, 36, 42, 48, 56, 72, 96];
const scales       = [ 1]; // more values blow up file size

const iconDefDir   = "./vector";          // holds pointer-icon definitions
const drawableDir  = "./vector/drawable"; // holds the actual vector drawables

const outputDir    = "./output";          // output directory
const scalableDir  = outputDir + "/cursors_scalable";
const legacyDir    = outputDir + "/cursors";

const addShadow     = true;
// this configuration closely matches the aosp raster cursor drawable images
// even though the actual rendering in android seems to be thicker
const shadowBlur    = 1;
const shadowOffsetX = 0;
const shadowOffsetY = 1;
const shadowColor   = "#000";
const shadowOpacity = 0.4;

// convert android color attrs to color values
const colorMap = await Bun.file("./color_map.json").json();
// convert odd android pointer names to proper css names
const nameMap = await Bun.file("./name_map.json").json();
// legacy and missing cursor aliases
const aliasList = await Bun.file("./alias.list").text();

const xmlParser = new XMLParser({ ignoreAttributes: false });

async function convertAndSave(inputData, outputPath){
	const svgContent = transform(inputData, {
		pretty: true,
		override: colorMap
	});

	let modifiedSvg = svgContent;

	if (addShadow) {
		const filterId = "fe-shadow";

		const filterSpread = 20;
		const offset = -filterSpread;
		const size   = 100 + filterSpread*2;

		const filterXml = `
		<defs>
      <filter id="${filterId}" x="${offset}%" y="${offset}%" width="${size}%" height="${size}%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceAlpha" stdDeviation="${shadowBlur}" />
        <feOffset dx="${shadowOffsetX}" dy="${shadowOffsetY}" result="offsetblur" />
        <feFlood flood-color="${shadowColor}" flood-opacity="${shadowOpacity}" />
        <feComposite in2="offsetblur" operator="in" />
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
		</defs>
		`;
			
			modifiedSvg = modifiedSvg.replace(/(<svg[^>]*>)/, `$1\n${filterXml}<g filter="url(#${filterId})">`);
			
			modifiedSvg = modifiedSvg.replace("</svg>", "</g>\n</svg>");
	}

	Bun.write(outputPath, modifiedSvg);
}

// delete and recreate directory
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

let files = [];

try {
	const entries = await readdir(iconDefDir, { withFileTypes: true });

	files = entries
	.filter(entry => entry.isFile())
	.map(entry => entry.name);
} catch (error) {
	console.error("Error reading directory:", error);
}

console.log(files);

// blazingly fast (🚀)
await Promise.all(files.map(async (file) => {
	// ---- metadata extraction ----

	const iconName = file.replace("_vector_icon.xml", "");
	const pointerName = iconName.replace("pointer_", "");
	let standardName = pointerName.replaceAll("_", "-");
	const mappedName = nameMap[standardName];
	if (mappedName !== undefined) {
		standardName = mappedName;
	}

	const iconXml = await Bun.file(`${iconDefDir}/${file}`).text();
	const iconObj = xmlParser.parse(iconXml);
	
	// android animated cursors have one static hotspot while other platforms support setting it per frame
	const hotspotX = parseFloat(iconObj["pointer-icon"]["@_android:hotSpotX"]?.replace("dp", "")) ?? 0;
	const hotspotY = parseFloat(iconObj["pointer-icon"]["@_android:hotSpotY"]?.replace("dp", "")) ?? 0;

	const drawable = iconObj["pointer-icon"]["@_android:bitmap"].replace("@drawable/", "");

	let metadata = [];
	
	console.log(standardName, hotspotX, hotspotY);
	
	// ---- svg conversion ----

	const drawableContent = await Bun.file(`${drawableDir}/${drawable}.xml`).text();

	const jsonObj = xmlParser.parse(drawableContent);
	const isAnimated = jsonObj["animation-list"] !== undefined;

	if (isAnimated) {
		console.log("Animated vector: " + drawable);
		const items = jsonObj['animation-list']?.item;

		const itemsArray = Array.isArray(items) ? items : [items].filter(Boolean);

		console.log("Number of frames:", itemsArray.length);
		
		for(const item of itemsArray){
			const frameDrawable = item["@_android:drawable"].replace("@drawable/", "");
			const frameDuration = parseInt(item["@_android:duration"]) ?? 1;
			const frameFilename = frameDrawable + ".svg";

			const frameContent = await Bun.file(`${drawableDir}/${iconName}/${frameDrawable}.xml`).text();
			const frameObj = xmlParser.parse(frameContent);
			const shapeSize = parseFloat(frameObj["vector"]["@_android:viewportWidth"]) ?? 24;

			await convertAndSave(frameContent, `${scalableDir}/${standardName}/${frameFilename}`)
			
			metadata.push({
				"filename": frameFilename,
				"delay": frameDuration,
				"hotspot_x": hotspotX,
				"hotspot_y": hotspotY,
				"nominal_size": shapeSize,
			});
		}
	}else {
		const shapeSize = parseFloat(jsonObj["vector"]["@_android:viewportWidth"]) ?? 24;

		const filename = pointerName + ".svg";

		await convertAndSave(drawableContent, `${scalableDir}/${standardName}/${filename}`)

		metadata = [{
			"filename": filename,
			"hotspot_x": hotspotX,
			"hotspot_y": hotspotY,
			"nominal_size": shapeSize,
		}];
	}
	await Bun.write(`${scalableDir}/${standardName}/metadata.json`, JSON.stringify(metadata))
}));

// ---- compatibility aliases ----

const lines = aliasList.split("\n");

let done = 0;

for(const line of lines){
	const cleanLine = line.trim().replaceAll(/\s+/g, " ");

	if (cleanLine.startsWith("#") || cleanLine === "") continue;

	if(cleanLine.indexOf(" ") == -1 || cleanLine.indexOf(" ") != cleanLine.lastIndexOf(" ")){
		console.log("Invalid line. syntax: <alias> <target>");
		continue;
	}

	const [alias, target] = cleanLine.split(" ");

	const aliasPath = `${scalableDir}/${alias}`;
	const aliasExists = await exists(aliasPath);

	if(!aliasExists){
		await symlink(target, aliasPath, "dir");
		done++;
		console.log(alias, target);
	}
}

console.log(`Created ${done} symlinks`);

// ---- xcursor conversion ----
const sizeString  = sizes.join(",");
const scaleString = scales.join(",");
await $`kcursorgen --svg-theme-to-xcursor --svg-dir=${scalableDir} --xcursor-dir=${legacyDir} --sizes=${sizeString} --scales=${scaleString}`;

// ---- theme index file ----
await Bun.write(`${outputDir}/index.theme`, `[Icon Theme]
Name=${themeName}
`);

// ---- license notice ----
await copyFile("NOTICE", `${outputDir}/NOTICE`)

// ---- final packaging ----
console.log("Making archive...");
await $`tar -czf ${themeIdentifier}.tar.gz --transform "s|^${outputDir}|${themeIdentifier}|" ${outputDir}`;

console.log("Done!");
console.log(`Theme '${themeName}' saved as ${themeIdentifier}.tar.gz`);
