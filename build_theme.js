import { rm, mkdir, readdir, symlink, exists, copyFile } from "node:fs/promises";
import { XMLParser } from "fast-xml-parser";
import { transform } from "vector-drawable-svg";
import { $ } from "bun";

const themeName       = "AOSP Cursors";
const themeIdentifier = "aosp-cursors";

// the optical size of your cursor shapes, NOT the canvas size!
const	nominalSize   = 18;

const sizes         = [18, 24, 30, 36, 42, 48, 56, 72, 96];
const windowsSizes  = [32, 48, 64, 96, 128];

// whether the script will build the theme for windows or for linux
const buildWindows  = Bun.env.BUILD_WINDOWS === "true";

const addShadow     = true;
const shadowBlur    = 1;
const shadowOffsetX = 0;
const shadowOffsetY = 1;
const shadowColor   = "#000"
const shadowOpacity = 0.4;

// holds the files with the hotspot definitions
const iconDefDir   = "./vector"
// holds the files with the actual vectors, may be the same as the above
const drawableDir  = `${iconDefDir}/drawable`;
// whether animation frames are stored in a subdirectory: drawableDir/iconName/
const nestFrames   = true;

const outputDir    = "./output";
const linuxDir     = `${outputDir}/linux`;
const scalableDir  = `${linuxDir}/cursors_scalable`;
const legacyDir    = `${linuxDir}/cursors`;
const windowsDir   = `${outputDir}/windows`;

// preferred canvas size for windows cursors
const winMinSize   = 32;

// maps android color attrs to color values
const colorMap  = await Bun.file("./color_map.json").json();
// maps odd android pointer names to proper css names
const nameMap   = await Bun.file("./name_map.json").json();
// legacy and missing cursor aliases
const aliasList = await Bun.file("./alias.list").text();

const xmlParser = new XMLParser({ ignoreAttributes: false });

async function convertAndSave(inputData, outputPath){
	const svgContent = transform(inputData, {
		pretty: true,
		override: colorMap
	});

	let finalSvg = svgContent;

	if (buildWindows) {
		finalSvg = finalSvg
			.replace(/width="\d+"/, `width="${winMinSize}"`)
			.replace(/height="\d+"/, `height="${winMinSize}"`)
			.replace(/viewBox="0 0 \d+ \d+"/, `viewBox="0 0 ${winMinSize} ${winMinSize}"`);
	}

	if (addShadow) {
		const filterId = "fe-shadow";

    const filterXml = `<defs>
    <filter id="${filterId}" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="${shadowBlur}" />
    </filter>
  </defs>`;
	
		const contentStart = finalSvg.indexOf(">") + 1;

		const openingTag   = finalSvg.slice(0, contentStart);
		const innerContent = finalSvg.slice(contentStart, finalSvg.lastIndexOf("</svg>")).trim();

		const shadowContent = innerContent
			.replace(/\sid="[^"]+"/g, "")
			.replace(/\sfill="[^"]+"/g, ` fill="${shadowColor}"`);

		// I have to apply the shadow filter to a duplicate of the paths here because kwin
		// doesn't like feMerge (it results in the whole thing being treated as a static bitmap)
		// and even this is still not perfect, see https://bugs.kde.org/show_bug.cgi?id=521145
		finalSvg = `${openingTag}
  ${filterXml}
  <g filter="url(#${filterId})" opacity="${shadowOpacity}" transform="translate(${shadowOffsetX}, ${shadowOffsetY})">
    ${shadowContent}
  </g>
  ${innerContent}
</svg>`;
	}

	await Bun.write(outputPath, finalSvg);
}

// empty the output directory
await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

let iconDefs = [];

try {
	const entries = await readdir(iconDefDir, { withFileTypes: true });

	iconDefs = entries
	.filter(entry => entry.isFile() && entry.name.endsWith("_icon.xml"))
	.map(entry => entry.name);
} catch (error) {
	console.error("Error reading directory:", error);
}

// so that the final canvas is exactly the required size (32x)
const nominalOrWinSize = buildWindows ? winMinSize : nominalSize;

// blazingly fast (🚀)
await Promise.all(iconDefs.map(async (iconDef) => {
	// ---- metadata extraction ----

	const iconName = iconDef.replace("_vector_icon.xml", "");
	const pointerName = iconName.replace("pointer_", "");
	let standardName = pointerName.replaceAll("_", "-");
	const mappedName = nameMap[standardName];
	if (mappedName !== undefined) {
		standardName = mappedName;
	}
	
	const iconXml = await Bun.file(`${iconDefDir}/${iconDef}`).text();
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
			const frameFilename = `${frameDrawable}.svg`;

			const dirPrefix = nestFrames ? `${iconName}/` : "";
			const frameContent = await Bun.file(`${drawableDir}/${dirPrefix}${frameDrawable}.xml`).text();

			await convertAndSave(frameContent, `${scalableDir}/${standardName}/${frameFilename}`)
			
			metadata.push({
				"filename": frameFilename,
				"delay": frameDuration,
				"hotspot_x": hotspotX,
				"hotspot_y": hotspotY,
				"nominal_size": nominalOrWinSize,
			});
		}
	}else {
		const filename = `${pointerName}.svg`;

		await convertAndSave(drawableContent, `${scalableDir}/${standardName}/${filename}`)

		metadata = [{
			"filename": filename,
			"hotspot_x": hotspotX,
			"hotspot_y": hotspotY,
			"nominal_size": nominalOrWinSize,
		}];
	}
	await Bun.write(`${scalableDir}/${standardName}/metadata.json`, JSON.stringify(metadata))
}));

// ---- compatibility aliases ----

const lines = aliasList.split("\n");

let done = 0;

for(const line of lines){
	const cleanLine = line.split("#")[0].trim().replaceAll(/\s+/g, " ");

	if (cleanLine === "") continue;

	if(cleanLine.indexOf(" ") === -1 || cleanLine.indexOf(" ") !== cleanLine.lastIndexOf(" ")){
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
const sizeString  = (buildWindows ? windowsSizes : sizes).join(",");
await $`kcursorgen --svg-theme-to-xcursor --svg-dir=${scalableDir} --xcursor-dir=${legacyDir} --sizes=${sizeString}`;

if (!buildWindows) {
	// ---- theme index file ----
	await Bun.write(`${linuxDir}/index.theme`, `[Icon Theme]
Name=${themeName}
`);

	// ---- license notice ----
	await copyFile("NOTICE", `${linuxDir}/NOTICE`);

	// ---- linux packaging ----
	console.log("Making archive...");
	const archiveName = `${themeIdentifier}-linux.tar.xz`;
	await $`tar -cJf "${outputDir}/${archiveName}" --transform "s|^${linuxDir}|${themeIdentifier}|" ${linuxDir}`;

	console.log("Done!");
	console.log(`Theme '${themeName}' saved as ${outputDir}/${archiveName}`);
}
if (buildWindows) {
	// ---- build windows theme ----
	console.log("Building Windows cursor theme...");
	if (!Bun.which("x2wincurtheme")) {
		console.log("x2wincurtheme was not found, please make sure win2xcur is installed");
	}else{
		await $`x2wincurtheme --name ${themeName} --output ${windowsDir} ${legacyDir}`;
		console.log("Done!");

		await copyFile("NOTICE", `${windowsDir}/NOTICE`);

		console.log("Making Windows archive...");
		const winArchiveName = `${themeIdentifier}-windows.zip`;
		await $`zip -rjq "${outputDir}/${winArchiveName}" "${windowsDir}"`;
		console.log(`Windows theme saved as ${winArchiveName}`);
	}
}