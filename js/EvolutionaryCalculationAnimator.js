
/*
Ideja:
Naslov: Vizualizacija uspešnosti evolucijskega računanja v programskem jeziku java script

Input:
algID; algName;[algParams];problemID; problemName;problemDim;[problemParams]
{id; generation; [parentids]; timestamp; eval; fitness; [x]}*

GUI:
Speed (10xslow), load, play
2dGraph [x_a,x_b] ali [fit, x_a]
Več grafov;
*/

/*
* Jquery plugin for animating data of evolutionary calculation algorithms
* Prerequisites:
* - Jquery ^3.1.0
* - ** RAFPolyfill.js (request animation frame polyfill, if using older browsers) https://gist.github.com/paulirish/1579671
*
* Init properties (OBJECT) containing:
* - source 			string	REQUIRED	URL of the source file, or raw source data, depending on the settings (read below)
* 			URL SOURCE NOT YET IMPLEMENETED!
*
* - sourceType		string 	Optional	Set type of source, defaults to "URL". Possible types: "URL", "STRING"
*
* - playOnLoad		bool	Optional	Defines if playback should start when plugin is done loading, defaults to true.
*
* - display			array	Optional	Defines how many (2 per canvas) and which X values to show
* 		Shows all combinations of X-es by default e.g.: If the problem has 3 dimensions -> [x1,x2], [x1,x3], [x2,x3]
*		Can also display fitness: [fit, x1]
* 		Defined as an array, where the first X is numbered as "1": [1,2]  would display a canvas elements containing a graph, showing [x1,x2]
*		To show multiple combinations define an array of arrays: [[1,2],[2,3]] -> [x1,x2] and [x2,x3]
*
* - canvasSize 		array 	Optional	Defines dimensions of each canvas seperately, or  globally.
* 		If only an array of 2 integers is set, that will be considered as the dimension for all canvases: [300,300]
* 		You can also pass an array of arrays (Identical in size to the above "display" array!) that will set dimensions for each canvas seperately
*
* - fps 			integer Optional 	Frames per second, defaults to  25
*
* - shadingHistory 	boolean Optional 	Display or hide step history with shading, defaults to true
*
*	Example configuration of plugin properties:

$('#selector').evoAnimate({
	source: 'www.something.com/evolution.txt',
	sourceType: 'URL',
	playOnLoad: false,
	display: [1,2],
	fps: 25,
}};

*/


$.fn.evoAnimate = function(props) {
	// Static plugin private vars
	var self = this;
	var container = self;
	var ARGS_NUM = 7; // Number of arguments in the first line of the input (this should never change, unless the format of the input string will change)
	var SMALLEST_CANVAS_DIM = [300,200]; // Smallest allowed values for canvas size (to prevent menu overlaps or inabillity to use it)
	// Default values
	var DEFAULT_CANVAS_SETTING = {
		id: -1,
		canvas: undefined,
		ctx: undefined,
		width: 300,
		height: 300,
		xIndex: 1, // Index of the algorithm step's X value to be displayed on this canvas's x axis
		yIndex: 1, // Same for the y axis
		shadeStartsCounter: [],
	};

	// Non-static private vars
	// Animation data
	var ANIMATION_DATA = {}; // Parsed animation data
	var CANVAS_ARR = []; // Array of canvases
	var CANVAS_X_SETTING = []; // Sets which X should be displayed on which canvas
	var CANVAS_SIZE_SETTING = []; // Sets canvas sizes
	var RENDERED_GENERATIONS = []; // Stores generations that are to be rendered in current frame

	// Playback
	var GENERATION_STARTS = []; // Array of indexes where given generation starts e.g.: [0,10,16] would indicate that generation 2 starts on index 10
	var LAST_GENERATION = 1; // Store number of the last generation
	var REQUEST_LOOP = undefined; // Request loop
	var IS_LOADED = false; // Boolean that indicates if any data is loaded (so we can start playback)
	var IS_PLAYING = false; // Indicates if animation is playing
	var IS_SETUP = false; // Indicates if canvas and other elements needed have been setup
	var PLAY_STEP = 0; // Current step number
	var LAST_GEN_ADD_FRAME = 0; // Stores the number of frames elasped since the last time we added a new generation to the playback
	var LAST_ADDED_GENERATION = 1; // Id of the last generation added to the rendering



	// Playback FPS limiting variables
	var fps = 600;
	var fpsInterval;
	var now;
	var then;
	var elapsed;

	// Playback user settings
	var SHOWN_GENERATIONS_NUMBER = 3; // Defines number of generations to be shown on the canvas e.g.: if 3, the last 3 generations will be shown. 0 = all generations.
	var ADD_GENERATION_AFTER = 1; // Defines the frame interval at which a new generation is added e.g.: 25 -> a new generation is added every 25 frames


	// Graphic settings
	var CANVAS_BG_COLOR = '#FFFFFF';

	// Point colors
	var POINT_CURRENT_COLOR = '#FF0000';
	var POINT_PREVIOUS_GEN_COLOR = '#00FF00';
	var POINT_OLDER_COLORS = '#0000FF';

	// Line color
	var LINE_CURRENT_COLOR = '#000000';


	// Menu layer globals
	var MENU_SHOWN = false;
	var MENU_BUTTON_SHOWN = false;

	// Shading history for each canvas
	// We count the number of steps that have hit the same pixel, and add darker shades to pixels that have had more steps on them, to display algorithm search area
	var USE_SHADING_HISTORY = true;
	var CANVAS_SHADES_NUM = 10;
	var CANVAS_SHADES_COLORS = ['#E5E5E5', '#CBCBCB', '#B1B1B1', '#979797', '#7D7D7D', '#636363', '	#494949', '#2F2F2F', '#151515', '#000000']; // Array of CANVAS_SHADES_NUM colors
	var CANVAS_SHADES = {}; // Array that stores numbers, at which a certain shade should start

	/*
	* Set problem's range, for proper scaling on the canvas
	* @param object data 	Object with algorithm data
	*/
	function setProblemRange(data) {
		var min = 9999;
		var max = -9999;
		for(var i in data.steps){
			var step = data.steps[i];
			for(var j in step.x) {
				var x = step.x[j];
				min = x < min ? x : min;
				max = x > max ? x : max;
			}
		}
		data.problemRange = (max - min);
		data.problemLowestNum = min;
	}
	/*
	* Calculates number of steps that have hit each pixel, to calculate proper shading values (for each canvas seperately)
	* @param object 	data 		Object with algorithm data
	* @param object 	canvasObj 	Canvas object
	*/
	function calculateShades(data, canvasObj) {
		var x = canvasObj.xIndex - 1;
		var y = canvasObj.yIndex - 1;
		var numOfShades = CANVAS_SHADES_NUM + 1; // Number of shades
		// Add + 1 because we will find values in between 2 values later ( shade[i] < VALUE < shade[i+1])

		//Crate 2d array of same dimensions as the canvas
		var array = evolutionUtil.fill2DArray(new Array(), canvasObj.width + 1, canvasObj.height + 1);
		// Count amount of steps on the same pixel
		for(var i in data.steps) {
			var step = data.steps[i];
			var coords = coordinateTransform(canvasObj, step.x[x], step.x[y]);
			coords.x = Math.floor(coords.x);
			coords.y = Math.floor(coords.y);
			array[coords.x][coords.y]++;
		}
		// Find the cell with the maximum amount of steps on it
		var max = -1;
		var min = 9999999;
		for(var i in array){
			var row = array[i];
			for(var j in row) {
				var cell = row[j];
				if(cell > max)
					max = cell;
				if(cell < min && cell > 0)
					min = cell;
			}
		}
		max = max;
		// Create array of zeroes with size: numOfShades
		var shadeStarts = [];
		for(var i = 0; i < numOfShades; i++)
			shadeStarts.push(0);
		// If maximum hits is less than number of shades simply put them in order from front to back
		if(max < numOfShades) {
			var iterator = numOfShades - 1;
			for(var i = max; i > 0 ; i--)
				shadeStarts[iterator--] = i;
		} else {
			var growth = false;
			// Else calculate step (divison) and fill the array by adding it
			var divisionOriginal =  max / numOfShades;
			var division = divisionOriginal / numOfShades;
			if(division > 10)
				growth = true;
			var start = min;
			for(var i in shadeStarts) {
				shadeStarts[i] = Math.round(start);
				if(growth)
					start += (division * (parseInt(i)));
				else
					start += divisionOriginal;
			}
		}
		CANVAS_SHADES[canvasObj.id] = shadeStarts;
	}


	/*
	* Increments shade starts counter array on the given position
	* @param object 		canvasObj 		Canvas object
	* @param integer 		x 				X coordinate
	* @param integer 		y 				Y coordinate
	* @param boolean 		transformed 	Indicates if coordinates have already bene transformed
	*/
	function incrementShadeOnPoint(canvasObj, x, y, transformed = true) {
		if(!isShadingHistory())
			return;
		if(!transformed) {
			var coords = coordinateTransform(canvasObj, x, y);
			x = coords.x;
			y = coords.y;
		}
		x = Math.floor(x);
		y = Math.floor(y);
		// Inline undefined checks
		var rtrn =  (undefined === canvasObj.shadeStartsCounter[x] ? -1 :  (undefined === canvasObj.shadeStartsCounter[x][y] ? -1 : canvasObj.shadeStartsCounter[x][y]++) ) + 1;
		return rtrn;

	}

	/*
	* Gets proper shade (color) for given coordinate
	* @param object 		canvasObj 		Canvas object
	* @param integer 		x 				X coordinate
	* @param integer 		y 				Y coordinate
	*/
	function getShade(canvasObj, x, y) {
		var counterValue = canvasObj.shadeStartsCounter[x][y];
		var shadeStarts = CANVAS_SHADES[canvasObj.id];
		var prevShadeValue = shadeStarts[0];
		if(counterValue > shadeStarts[0])
			for(var i = 1; i < shadeStarts.length; i++) {
				var shadeValue = shadeStarts[i];
				if(counterValue > prevShadeValue && counterValue  <= shadeValue) {
					return CANVAS_SHADES_COLORS[i - 1];
				}
			}
		// This should never happen
		return CANVAS_BG_COLOR;
	}

	/*
	* Renders shades on each pixel
	* @param object 		canvasObj 		Canvas object
	* @param integer 		x 				X coordinate
	* @param integer 		y 				Y coordinate
	*/
	function renderShadePoint(canvasObj, x, y) {
		var ctx = canvasObj.bgLayerCtx;
		var color = getShade(canvasObj, x, y);
		ctx.fillStyle = color;
		ctx.fillRect(x, y, 2, 2);
	}

	/*
	* Renders all shades of given canvasObj
	* @param object 	canvasObj 		Canvas object
	*/
	function renderShades(canvasObj) {
		var x = canvasObj.width;
		var y = canvasObj.height;
		for(var i = 0; i < x; i++) {
			for(var j = 0; j < y; j++) {
				if(canvasObj.shadeStartsCounter[i][j] > CANVAS_SHADES[canvasObj.id][0])
					renderShadePoint(canvasObj, i, j);
			}
		}
	}

	/*
	* Renders all shades on all canvas elements
	*/
	function renderAllCanvasesShades() {
		for(var i in CANVAS_ARR)
			renderShades(CANVAS_ARR[i]);
	}

	/*
	* Parses entire input text (document)
	* @param string	input 	String input
	*/
	function parseInput(input){
		var rtrn = {};
		rtrn.steps = []; // Algorithm steps will be stored in an array
		// Parsing arguments
		evolutionUtil.indexOfAll(input, ';', function(index, prev, count){
			prev = prev > 0 ? prev + 1 : prev; // If previous index is above 0, add 1 (because that index is the ";")
			var item =  this.substring(prev, index);
			if('' === item) {
				return false;
			}
			if(count < ARGS_NUM) {
				parseArgs(rtrn, item, count);
			} else {
				// End loop
				return true;
			}
		});
		//Parse the remaining lines
		evolutionUtil.indexOfAll(input, ['{','}'], function(index, prev, count){
			if(0 === prev) //If we found the first "{" pass
				return false;
			prev += 1; // Add 1  to prev (because that index is the "{" or "}")
			var item =  this.substring(prev, index);
			if('' === item) {
				return false;
			}
			// Special case of newline in the produced text?
			// Trim empty strings/newlines and check if it is still empty, in that case "continue"
			if('' !== item.trim())
				parseLine(rtrn, item);
		});
		// Find starting points of generations
		findGenerationStarts(rtrn);
		// If new data is loaded, canvases must be re-set up
		IS_SETUP = false;
		// Data is loaded
		IS_LOADED  = true;
		// Reset steps if new data is loaded
		PLAY_STEP = 0;
		// Get problem's maximum range
		setProblemRange(rtrn);
		// If the display array is not set, create all combinations of X-es
		if(undefined === CANVAS_X_SETTING) {
			var problemDim = rtrn.problemDim;
			var combinationArr = [];
			for(var i = 0; i< problemDim; i++) {
				for(var j = i + 1; j < problemDim; j++) {
					combinationArr.push([i + 1, j + 1]);
				}
			}
			CANVAS_X_SETTING = combinationArr;
		}
		rtrn.lastGeneration = evolutionUtil.lastItem(rtrn.steps).generation;
		return rtrn;
	}

	/*
	* Parses global arguments:
	* algID; algName;[algParams];problemID; problemName;problemDim;[problemParams]
	* @param object 	obj 	Object that stores the parsed values
	* @param string		arg 	(one) argument value
	* @param integer	argNum 	argument's number
	*/
	function parseArgs(obj, arg, argNum) {
		switch(argNum){
			case 0: { // algID
				obj.algId = parseInt(arg);
				break;
			}
			case 1: { // algName
				obj.algName =  arg;
				break;
			}
			case 2: { // [algParams]
				obj.algParams = evolutionUtil.parseArray(arg);
				break;
			}
			case 3: { // problemID
				obj.problemId = parseInt(arg);
				break;
			}
			case 4: { // problemName
				obj.problemName =  arg;
				break;
			}
			case 5: { // problemDim
				obj.problemDim = parseInt(arg);
				break;
			}
			case 6: { // [problemParams]
				obj.problemParams = evolutionUtil.parseArray(arg);
				break;
			}
		}
		return obj;
	}

	var FIRST_GEN_IS_ZERO = false;
	/*
	* Parses argument via it's number inside line
	* @param string/array 	arg 	argument value
	* @param integer 		argNum 	argument's number
	*/
	function parseLineArg(obj, arg, argNum) {
		switch(argNum) {
			case 0: { // id
				obj.id = parseInt(arg);
				break;
			}
			case 1: { // generation
				arg = parseInt(arg);
				// Because code was first designed so that the first generation is always 1, add a safeguard here
				if(0 === arg && !FIRST_GEN_IS_ZERO)
					FIRST_GEN_IS_ZERO = true;
				if(FIRST_GEN_IS_ZERO)
					arg++;
				obj.generation = parseInt(arg);
				break;
			}
			case 2: { // [parentIds]
				obj.parentIds = evolutionUtil.parseArray(arg);
				break;
			}
			case 3: { // timestamp
				obj.timestamp = arg;
				break;
			}
			case 4: { // eval
				// TODO: poglej kaj je eval; integer/float?
				obj.eval = arg;
				break;
			}
			case 5: { // fitness
				obj.fitness = parseFloat(arg);
				break;
			}
			case 6: { // [x]
				obj.x = evolutionUtil.parseArray(arg);
				break;
			}

		}
		return obj;
	}

	/*
	* Parses all the other lines of input
	* {id; generation; [parentids]; timestamp; eval; fitness; [x]}
	* @param object 	obj 	Object that stores the parsed values
	* @param string 	line 	String of one line of the input
	*/
	function parseLine(obj, line) {
		var lineObj = {};
		// Check if last char in line is ";", if not add it (to make sure the loop works)
		if(line[line.length -1] !== ';'){
			line += ';';
		}
		evolutionUtil.indexOfAll(line, ';', function(index, prev, count){
			prev = prev > 0 ? prev + 1 : prev; // If previous index is above 0, add 1 (because that index is the ";")
			var item =  this.substring(prev, index);
			if('' === item) {
				return false;
			}
			parseLineArg(lineObj, item, count);
		});
		obj.steps.push(lineObj);
	}

	/*
	* Finds starting indexes of generations and stores them in an array
	* @param object 	data 	Input data object
	*/
	function findGenerationStarts(data) {
		//The first generation will always start on 0
		GENERATION_STARTS.push(0);
		var currentGen = 1;
		for(var i in data.steps) {
			var step = data.steps[i];
			if(step.generation > currentGen) {
				GENERATION_STARTS.push(parseInt(i));
				currentGen++;
			}
		}
		LAST_GENERATION = currentGen;
	}
	/*
	* Check if data is loaded
	*/
	function isLoaded() {
		return true === IS_LOADED ? true : false;
	}

	/*
	* Check if animation is playing
	*/
	function isPlaying() {
		return undefined !== REQUEST_LOOP ? true : false;
	}

	/*
	* Check if canvases are setup
	*/
	function isSetup() {
		return true === IS_SETUP ? true : false;
	}

	/*
	* Checks if we are using shading history
	*/
	function isShadingHistory() {
		return true ===  USE_SHADING_HISTORY ? true :  false;
	}

	/*
	* Check if given generation can be rendered
	* @param integer genNum 	Generation number
	*/
	function checkGenIsShown(genNum) {
		// 0 indicates all generations are shown
		if(0 === SHOWN_GENERATIONS_NUMBER)
			return true;
		for(var i in RENDERED_GENERATIONS)
			if(RENDERED_GENERATIONS[i] === genNum)
				return true;
			return false;
		}
	/*
	* Finds  step by id
	* @param integer 	id 		Id of the step we are searching for
	*/
	function findStepById(id) {
		var steps = ANIMATION_DATA.steps;
		// Steps are numbered in the data, and should be on this spot
		if(steps[id - 1].id === id)
			return steps[id - 1];
		// If for some reason, steps are not numbered correctly, loop throught and find the correct one
		for(var i in steps) {
			var step = steps[i];
			if(step.id === id)
				return step;
		}
	}

	/*
	* Render a step on a given canvas
	* @param integer 	x 				X coordinate
	* @param integer 	y 				Y coordinate
	* @param object 	canvasObj 			Object with canvas data
	* @param array 		parentCoords 	 Array of coordinate objects for N parents
	* @param boolean 	drawLine 		Indicates if line is to be drawn from current point to parents
	*/
	function renderStep(x, y = 0, canvasObj, parentCoords,  drawLine = true) {
		var ctx = canvasObj.renderLayerCtx;
		ctx.fillStyle = POINT_CURRENT_COLOR;
		var physicalCoords = coordinateTransform(canvasObj, x, y);
		ctx.fillRect(physicalCoords.x, physicalCoords.y, 2, 2);
		// Add line from the previously drawn point
		if(true === drawLine) {
			ctx.strokeStyle = LINE_CURRENT_COLOR;
			for(var i in parentCoords) {
				var coords = parentCoords[i];
				prevCoords = coordinateTransform(canvasObj, coords.x, coords.y);
				ctx.beginPath();
				ctx.moveTo(prevCoords.x, prevCoords.y);
				ctx.lineTo(physicalCoords.x, physicalCoords.y);
				ctx.stroke();
			}
		}
		// Increment shades
		if(isShadingHistory())
			incrementShadeOnPoint(canvasObj, physicalCoords.x, physicalCoords.y);
	}

	/*
	* Fades given points (previous generation)
	* @param object 	ctxObj 		Object with canvas data
	* @param array 		parents 	Array of parents, should always be only 2
	* @param integer 	childX 		Child's X coordinate
	* @param integer 	childY 		Child's Y coordinate
	* @param integer 	childGenId 	Child's generation ID
	*/
	function fadePoints(ctxObj, parents, childX, childY, childGenId) {
		if(!checkGenIsShown(childGenId - 1))
			return;
		var ctx = ctxObj.renderLayerCtx;
		// X and Y axis values are stored via the indexes, which start with 1 (X1 = 1)
		var x = ctxObj.xIndex - 1;
		var y = ctxObj.yIndex - 1;
		// Convert child coordinates to physical
		var physicalCoords = coordinateTransform(ctxObj, childX, childY);
		childX = physicalCoords.x;
		childY = physicalCoords.y;
		for(var i in parents) {
			var parent = parents[i];
			// Both parents get POINT_PREVIOUS_GEN_COLOR
			ctx.fillStyle = POINT_PREVIOUS_GEN_COLOR;
			physicalCoords = coordinateTransform(ctxObj, parent.x[x], parent.x[y]);
			ctx.fillRect(physicalCoords.x, physicalCoords.y, 2, 2);

			// First check if we can show parents
			if(checkGenIsShown(childGenId - 2)) {
				// Parents of these parents get POINT_OLDER_COLORS
				ctx.fillStyle = POINT_OLDER_COLORS;
				for(var i in parent.parentIds) {
					var parentsParent = -1 !== parent.parentIds[i] ? findStepById(parent.parentIds[i]) : undefined;
					if(undefined === parentsParent)
						continue;
					physicalCoords = coordinateTransform(ctxObj, parentsParent.x[x], parentsParent.x[y]);
					ctx.fillRect(physicalCoords.x, physicalCoords.y, 2, 2);
				}
			}
		}
	}

	/*
	* Performs all steps within one generation
	* @param object 	data 		Data object for the algorithm we are currently animating
	* @param integer	genNumber	Generation number
	*/
	function stepGen(data, genNumber) {
		// Calculate the length of the current generation
		var generationLength = (GENERATION_STARTS.length > genNumber ? GENERATION_STARTS[genNumber] : data.steps.length) - GENERATION_STARTS[genNumber - 1];
		//Make sure step is set to the start of the generation
		var stepId = GENERATION_STARTS[genNumber - 1];
		for(var i = 0; i < generationLength; i++) {
			step(data.steps[stepId++]);
		}
		PLAY_STEP = stepId;
	}

	/*
	* Performs one step of the algorithm
	* @param object 	stepData 	Data object for the current step
	*/
	function step(stepData) {
		var hasAtLeastOneParent = false;
		var parents = [];
		for(var i in stepData.parentIds) {
			var parent = -1 !== stepData.parentIds[i] ? findStepById(stepData.parentIds[i]) : undefined;
			parents.push(parent);
		}
		// Loop throught all the x values of the step
		// Loop throught all canvases, because all canvases will have a change on every step!
		for(var i in CANVAS_ARR) {
			var canvasObj = CANVAS_ARR[i];
			// X and Y axis values are stored via the indexes, which start with 1 (X1 = 1)
			var x = canvasObj.xIndex - 1;
			var y = canvasObj.yIndex - 1;
			// Get actual values from current step data
			var x1 = stepData.x[x];
			var x2 = stepData.x[y];
			// Check if parents exist
			var drawLine = false;
			var parentCoords = [];
			hasAtLeastOneParent = false;
			// Push parnet coordinates for current canvas
			for(var i in parents) {
				parent = parents[i];
				if(undefined !== parent) {
					parentCoords.push({ x: parent.x[x], y: parent.x[y] });
					hasAtLeastOneParent = true;
				}
			}

			// Draw line if it can be shown (only draw lines for the very last generation)
			drawLine = evolutionUtil.lastItem(RENDERED_GENERATIONS) === stepData.generation ? true : false;
			renderStep(x1, x2, canvasObj, parentCoords, drawLine);

			// "Fade" parents
			if(hasAtLeastOneParent) {
				fadePoints(canvasObj, parents, x1, x2, stepData.generation);
			}
		}
	}
	/*
	* Clears all canvases
	*/
	function clearCanvases(){
		// Loop in reverse so the splice function works properly!
		// (And also we get numbering from 0 in JS array, unlike what happens when using DELETE)
		for(var i = CANVAS_ARR.length - 1; i >= 0 ; i-- ) {
			CANVAS_ARR[i].canvas.remove();
			CANVAS_ARR.splice(i, 1);
		}
	}

	/*
	* Spawns a canvas with the given id
	* @param integer 	id 			Canvas id
	* @param array 		axisIds		Ids of X to put on the axis: [1, 2] defines that x1 is on the X axis and x2 on the Y axis
	* @param array 		size		Array for canvas size: [300, 300] -> width: 300px, height: 300px
	*/
	function spawnCanvas(id, axisIds, size = undefined) {
		// Clone default settings
		var c = evolutionUtil.clone(DEFAULT_CANVAS_SETTING);
		id = id + '_' +  evolutionUtil.guid();
		c.id = id;
		//Set size
		if($.isArray(size)) {
			c.width = size[0];
			c.height = size[1];
		}
		c.xIndex = parseInt(axisIds[0]);
		c.yIndex = parseInt(axisIds[1]);

		// Create a canvas element (background)
		c.bgCanvas = $('<canvas/>').height(c.height).width(c.width).attr('height', c.height).attr('width', c.width).attr('id', id);
		container.append(c.bgCanvas );
		c.bgLayerCtx = c.bgCanvas [0].getContext('2d');

		// Create canvasStack object
		c.canvasStack = new CanvasStack(id);

		// Create render layer
		var tmpID = c.canvasStack.createLayer();
		c.renderCanvas = $('#' + tmpID);
		c.renderLayerCtx = c.renderCanvas[0].getContext('2d');

		// Create info layer
		tmpID = c.canvasStack.createLayer();
		c.infoCanvas = $('#' + tmpID);
		c.infoLayerCtx = c.infoCanvas[0].getContext('2d');

		//Create menu "layer"
		tmpID = c.canvasStack.createLayer();
		c.menuCanvas = $('#' + tmpID);
		c.menuLayerCtx = c.menuCanvas[0].getContext('2d');

		// Fill shade starts counter array with zeroes
		c.shadeStartsCounter = evolutionUtil.fill2DArray(c.shadeStartsCounter, c.width + 1, c.height + 1);

		// Push into array
		CANVAS_ARR.push(c);
		return c;
	}

	/*
	* Main animation loop
	*/
	function animationLoop() {
		// Calculate elapsed time since last loop
		now = Date.now();
		elapsed = now - then;
		if (elapsed > fpsInterval) {
			// Get ready for next frame by setting then=now, but also adjust for your
        	// specified fpsInterval not being a multiple of RAF's interval (16.7ms)
        	then = now - (elapsed % fpsInterval);
			// If canvases are setup
			if(isSetup()) {
				moveOneStepForward();
			}
		}

		// Request next frame
		REQUEST_LOOP = window.requestAnimationFrame(animationLoop);
	}

	/*
	* Clear RENDERED_GENERATIONS array and fill it according to SHOWN_GENERATIONS_NUMBER towards a given generation
	* @param integer 	num Generation number
	*/
	function setRenderedGenerations(num) {
		RENDERED_GENERATIONS = [];
		for(var i = num; i >= num - SHOWN_GENERATIONS_NUMBER + 1; i--) {
			if(i > 0)
				RENDERED_GENERATIONS.unshift(i);
		}
		LAST_ADDED_GENERATION = evolutionUtil.lastItem(RENDERED_GENERATIONS);
	}

	/*
	* Main render loop, using generations
	* If  lastGenId is above 0, lastGenStepId must be set. This will render all shown generations up to the lastGenId one, and only all steps up to lastGenStepId will be rendered in that one
	* @param integer 	lastGenId			Id of last gen to render
	* @param integer	lastGenStepId 		Id of the step to render up to in last generation
	*/
	var renderGenerations = function(lastGenId = -1, lastGenStepId = -1) {
		// Clear canvases
		for(var i in CANVAS_ARR) {
			var c = CANVAS_ARR[i];
			c.bgLayerCtx.clearRect(0, 0, c.width, c.height);
			c.renderLayerCtx.clearRect(0, 0, c.width, c.height);
			// Clear shades counter
			c.shadeStartsCounter = evolutionUtil.fill2DArray(c.shadeStartsCounter, c.width + 1, c.height + 1);
		}
		if(lastGenId < 0) {
			// First render shades
			renderAllCanvasesShades();
			// Draw all shown generations every frame, remove and add according to the settings
			if(0 === SHOWN_GENERATIONS_NUMBER) {
				for(var i = 1; i < ANIMATION_DATA.lastGeneration; i++) {
					stepGen(i);
				}
			} else {
				for(var i in RENDERED_GENERATIONS) {
					var currentGenID = RENDERED_GENERATIONS[i];
					stepGen(ANIMATION_DATA, currentGenID);
				}
			}

		} else {
			if(isShadingHistory()) {
				// Shading for points of generations not shown (all those in front of the first generation in RENDERED_GENERATIONS)
				var firstShownStep = GENERATION_STARTS[RENDERED_GENERATIONS[0] - 1];
				for(var i = 0; i < firstShownStep; i++) {
					var stepData = ANIMATION_DATA.steps[i];
					for(var j in CANVAS_ARR) {
						var canvasObj = CANVAS_ARR[j];
						// X and Y axis values are stored via the i ndexes, which start with 1 (X1 = 1)
						var x = canvasObj.xIndex - 1;
						var y = canvasObj.yIndex - 1;
						// Get actual values from current step data
						var x1 = stepData.x[x];
						var x2 = stepData.x[y];

						// Increment shaders
						incrementShadeOnPoint(canvasObj, x1, x2, false);
					}
				}
			}
			// First render shades
			renderAllCanvasesShades();


			// First render all generations except the last one
			for(var i in RENDERED_GENERATIONS) {
				var currentGenID = RENDERED_GENERATIONS[i];
				if(currentGenID < lastGenId) {
					stepGen(ANIMATION_DATA, currentGenID);
				}
			}

			// Then render all steps in the last given generation up to the given step id
			var startStep = GENERATION_STARTS[lastGenId - 1];
			// If last generation step id is 0, that means all steps within that generation
			if(lastGenStepId <= 0) {
				if(lastGenId < GENERATION_STARTS.length)
					lastGenStepId = GENERATION_STARTS[lastGenId];
				else
					lastGenStepId = ANIMATION_DATA.steps.length;

			}

			for(;startStep < lastGenStepId; startStep++) {
				step(ANIMATION_DATA.steps[startStep]);
			}
			PLAY_STEP = startStep;
		}
	}



	/*
	* Setups the page for playback (proper number of canvas elements)
	* @param object 	data 	Data object for the algorithm we are currently animating
	*/
	function playSetup() {
		// Do not reset canvases
		if(isSetup())
			return;
		// Canvas size
		var oneSize = 1 === CANVAS_SIZE_SETTING.length ? true : false;
		// Clear any previous canvases
		clearCanvases();
		var canvasId = 0;
		for(var i in CANVAS_X_SETTING) {
			var currentSizeArr = oneSize ? CANVAS_SIZE_SETTING[0] : CANVAS_SIZE_SETTING[i];
			// Spawn canvas for every 2 dimensions
			var newCanvas = spawnCanvas(canvasId++, CANVAS_X_SETTING[i], currentSizeArr);
			// Calculate shades for this canvas
			calculateShades(ANIMATION_DATA, newCanvas);
		}
		// Put the first generation into the proper array
		RENDERED_GENERATIONS = [1];
		// Reset some vars
		LAST_GEN_ADD_FRAME = 0;
		LAST_ADDED_GENERATION = 1;
		IS_SETUP = true;
	}

	/*
	* Starts playback
	*/
	var play = function() {
		if (isLoaded() && !isPlaying()) {
			// Set up the canvases
			playSetup(ANIMATION_DATA);
			// Set current time and FPS interval
			fpsInterval = 1000 / fps;
			then = Date.now();
			// Play the animation
			animationLoop();
		}
	}

	/*
	* Stops playback
	*/
	var stop = function() {
		if (isPlaying()) {
			window.cancelAnimationFrame(REQUEST_LOOP);
			REQUEST_LOOP = undefined;
		}
	}

	/*
	* Check if we moved into a step that is a different generation, and should update rendered generations
	* @param object 	generationNum 	Generation number were checking this on
	*/
	function checkRenderedGenerations(generationNum) {
		// If we are still in the same generation
		if(LAST_ADDED_GENERATION  === generationNum)
			return;
		if(LAST_ADDED_GENERATION <= LAST_GENERATION) {
			// Else increment to next generation
			LAST_ADDED_GENERATION++;
			LAST_GEN_ADD_FRAME = 0;
			//Add one generation
			RENDERED_GENERATIONS.push(LAST_ADDED_GENERATION);
			// Delete one, if there are more in the array than it is set in SHOWN_GENERATIONS_NUMBER
			if(RENDERED_GENERATIONS.length > SHOWN_GENERATIONS_NUMBER && 0 !== SHOWN_GENERATIONS_NUMBER) {
				RENDERED_GENERATIONS.splice(0,1);
			}
		}
	}

	/*
	* Moves one step forward
	*/
	var moveOneStepForward = function() {
		if(!isSetup())
			playSetup();
		if(PLAY_STEP < ANIMATION_DATA.steps.length) {
			var stepData = ANIMATION_DATA.steps[PLAY_STEP];
			checkRenderedGenerations(stepData.generation);
			renderGenerations(stepData.generation, PLAY_STEP + 1);
		}
	};
	/*
	* Moves one step forward
	*/
	var moveOneStepBackward = function() {
		if(!isSetup())
			playSetup();
		if(PLAY_STEP > 0) {
			// If we played animation to the last step, we came to the steps.length + 1 (so that we stopped the loop)
			if(ANIMATION_DATA.steps.length === PLAY_STEP)
				PLAY_STEP--; // Subtract one more
			PLAY_STEP--;
			var stepData = ANIMATION_DATA.steps[PLAY_STEP];
			var currentGenId = stepData.generation;
			// Because we are going backwards, special case generation check here
			if(RENDERED_GENERATIONS[0] + SHOWN_GENERATIONS_NUMBER - 1 > currentGenId && (RENDERED_GENERATIONS[0] - 1) > 0) {
				RENDERED_GENERATIONS.unshift(RENDERED_GENERATIONS[0] - 1);
			}
			// Remove any generations higher than the one we are currently rendering
			for(var i = RENDERED_GENERATIONS.length - 1; i > -1 ;i--) {
				if(RENDERED_GENERATIONS[i] > stepData.generation) {
					LAST_ADDED_GENERATION = RENDERED_GENERATIONS[i] - 1;
					RENDERED_GENERATIONS.splice(i, 1);
				} else {
					break;
				}
			}
			if(RENDERED_GENERATIONS.length > SHOWN_GENERATIONS_NUMBER && 0 !== SHOWN_GENERATIONS_NUMBER) {
				RENDERED_GENERATIONS.splice(RENDERED_GENERATIONS.length - 1,1);
			}
			renderGenerations(stepData.generation, PLAY_STEP, true);
		}
	};

	/*
	* Moves one generation forward. If we are in the middle of a generation it will only complete that generation!
	*/
	var moveOneGenerationForward = function() {
		// We willl use step forward function, so get the step ids from the array
		var nextGenStartId = ANIMATION_DATA.steps.length;
		for(var i in GENERATION_STARTS) {
			var current = GENERATION_STARTS[i];
			if(current > PLAY_STEP) {
				i = parseInt(i);
				break;
			}
		}
		setRenderedGenerations(i);
		renderGenerations(i, 0);
	}

	/*
	* Moves one generation backwards. If we are in the middle of a generation it will only move to the last step of the previous generation!
	*/
	var moveOneGenerationBackward = function() {
		// We willl use step forward function, so get the step ids from the array
		var previousGenStartId = 0;
		for(var i = GENERATION_STARTS.length; i >= 0; i--) {
			var current = GENERATION_STARTS[i];
			if(current < PLAY_STEP) {
				previousGenStartId = current;
				break;
			}
		}
		while(PLAY_STEP > previousGenStartId) {
			moveOneStepBackward();
		}
	}

	/*
	* Move to N generation
	* --------- NOTE: Generations start with 1!
	* @param integer 	num 	Number of generation to move to
	*/
	var moveToGenerationN = function(num) {
		if(num >= 0 && num <= ANIMATION_DATA.lastGeneration) {
			// Make sure rendered generations stores the correct numbers
			if(0 === SHOWN_GENERATIONS_NUMBER) {
				renderGenerations();
			} else {
				setRenderedGenerations(num);
				renderGenerations(num);
			}
		} else {
			console.warn('Error: Generation number out of bounds! Last generation: ' + ANIMATION_DATA.lastGeneration);
		}
	}



	/*
	* Transforms (scales) coordinates from problem dimensions to the physical dimensions on the canvas
	* @param object 	ctx 	Canvas context object
	* @param integer 	x 		Value of X
	* @param integer 	y 		Value of Y
	*/
	function coordinateTransform(ctx, x, y) {
		var tmpX = (x > 0 ? (ANIMATION_DATA.problemRange / x) : 0);
		var tmpY = (y > 0 ? (ANIMATION_DATA.problemRange / y) : 0);
		// Physical coordinates cannot be negative, if problem range goes below 0 add the difference to produce only positive numbers
		if(ANIMATION_DATA.problemLowestNum < 0) {
			var diff = 0 - ANIMATION_DATA.problemLowestNum;
			tmpX = ANIMATION_DATA.problemRange / (x + diff);
			tmpY = ANIMATION_DATA.problemRange / (y + diff);
		}
		var newX = 0 === tmpX ? 0 : ctx.width / tmpX;
		var newY = 0 === tmpY ? 0 : ctx.height / tmpY;
		return {x: newX, y: newY};
	}

	/*
	* Calulates shown steps on the timeline
	* @param integer 	cWidth 				Width of canvas that timeline is to be rendered on
	* @param integer 	stepPixelWidth 		Width of step column in pixels
	* @return returns object with starting and ending step number
	*/
	function calculateTimelineSteps(cWidth, stepPixelWidth = 5) {
		var currentStep = PLAY_STEP;
		var lastStep = ANIMATION_DATA.steps.length;
		var startStep = 0;
		var endStep = 0;

		var shownStepsNum = cWidth / stepPixelWidth;

		if(0 !== shownStepsNum % 2) { // If calulated number is odd, make it even, to get integers when dividing by 2
			shownStepsNum++;
		}
		// If we are near the end
		if(currentStep + shownStepsNum / 2 > lastStep) {
			endStep = lastStep;
			startStep = lastStep - shownStepsNum;
		}
		// If we are near the start
		else if(currentStep - shownStepsNum / 2 < 0) {
			startStep = 0;
			endStep = shownStepsNum;
		}
		// Else we will show current step in the middle
		else {
			startStep = currentStep - shownStepsNum / 2;
			endStep = currentStep + shownStepsNum / 2;
		}

		return {start: startStep, end: endStep};
	}

	/*
	* Renders one column in the timeline
	* @param object 	ctx 	Canvas context
	* @param integer 	x 		X position of the column
	* @param integer 	y 		Y position of the column
	* @param float 		colH 	Column height
	* @param float 		colO 	Column offset on top
	* @param integer 	stepPixelWidth 		Width of step column in pixels
	*/
	function renderColumn(ctx, x, y, colH, colO, stepPixelWidth = 5) {
		ctx.fillStyle = '#00FF00';
		ctx.rect(x, y + colO, stepPixelWidth, colH);
		ctx.fill();
	}

	/*
	* Renders timeline to given context
	* @param object 	canvasObj 			Canvas context object
	* @param integer 	timeLineHeight 		Height of timeline in pixels
	* @param integer 	stepPixelWidth 		Width of step column in pixels
	*/
	function renderTimeline(canvasObj, timeLineHeight = 50, stepPixelWidth = 5) {
		var ctx = canvasObj.bgLayerCtx; // TODO: where to draw this!?
		// Get starting and ending step numbers
		var start = calculateTimelineSteps(canvasObj.width);
		var end = start.end;
		start = start.start;

		// Starting position for rendering
		var startX = 0;
		var startY = canvasObj.height - timeLineHeight - 10;

		//First get maximum fitness of current timeline, so that we can transform heights properly
		var maxFitness = -99999;
		for(var i = start; i < end; i++) {
			var stepData = ANIMATION_DATA.steps[i];
			maxFitness = maxFitness < stepData.fitness ? stepData.fitness : maxFitness;
		}
		console.log(maxFitness);

		for(var i = start; i < end; i++) {
			var stepData = ANIMATION_DATA.steps[i];
			var fitness = stepData.fitness;
			// Transform fitness to a smaller scale
			var columnHeight = (fitness / maxFitness) * timeLineHeight;
			var columnOffset = timeLineHeight  - columnHeight;
			renderColumn(ctx, startX, startY, columnHeight, columnOffset);
			startX += stepPixelWidth;
		}
	}


	/*
	* Draws or clears background mesh
	* @param object 	canvasObj 	Canvas context object
	* @param boolean 	clear 	Flag indicates if we should clear the mesh, else draw it
	*/
	function drawMesh(canvasObj, clear = false) {
		// TODO: implement
	}

	/*
	* Display button that opens menu
	* @param object 	ctx 	Canvas context to draw on
	* @param boolean 	show 	Boolean indicating whether to hide or show button
	*/
	function menuButtonShow(ctx, show = false) {
		if(show === MENU_BUTTON_SHOWN)
			return;
		if(true === show) {
			//TODO: show some sort of graphic for menu button
			ctx.fillStyle = '#000000';
			ctx.fillRect(0,0,30,30);
			MENU_BUTTON_SHOWN = true;
		} else {
			ctx.clearRect(0,0,30,30);
			MENU_BUTTON_SHOWN = false;
		}
	}

	/*
	* Function that displays menu when clicking on the show menu button
	* @param object 	canvasObj 	Canvas object to draw menu on
	*/
	function menuButtonClicked(canvasObj) {
		if(false === MENU_SHOWN) {
			MENU_SHOWN = true;
			showHideMenu(MENU_SHOWN, canvasObj);
		} else {
			MENU_SHOWN = false;
			showHideMenu(MENU_SHOWN, canvasObj);
		}
		renderTimeline(canvasObj);
	}

	/*
	*
	* Function that shows/hides menu menu
	* @param boolean 	show 	Show menu if true, else hide
	* @param object 	canvasObj 	Canvas object to draw menu on
	*/
	function showHideMenu(show = true, canvasObj) {
		var ctx = canvasObj.menuLayerCtx;
		console.log(show);
		if(show) {
			// TODO draw menu
		} else {
			// TODO hide menu
		}
	}

	/*
	* Find any points below the mouse click, that are rendered on the canvas currently
	* @param integer 	offsetX 	X axis offset of the click (relative to canvas)
	* @param integer 	offsetY 	Y axis offset of the click (relative to canvas)
	* @param object 	canvasObj 	Canvas object clicked on
	*/
	function findPointsOnClick(offsetX, offsetY, canvasObj) {
		// Generate click area size from canvas width
		var areaX = canvasObj.width * 0.015;
		var areaY = canvasObj.height * 0.015;
		areaX = areaX < 5 ? 5 : areaX;
		areaY = areaY < 5 ? 5 : areaY;

		var firstGen = 0 === SHOWN_GENERATIONS_NUMBER ? 1 : RENDERED_GENERATIONS[0];
		var startStep = GENERATION_STARTS[firstGen - 1];
		var lastStep = 0 === SHOWN_GENERATIONS_NUMBER ? ANIMATION_DATA.steps.length :  GENERATION_STARTS[evolutionUtil.lastItem(RENDERED_GENERATIONS)];

		// We can have multiple points near the same area, so use an array
		var matchedSteps = [];
		for(var i = startStep; i < lastStep; i++) {
			var step = ANIMATION_DATA.steps[i];
			// Check if step hasn't been rendered yet
			if(step.id > PLAY_STEP + 1)
				continue;
			// Check if step is still visible (it is not in an older generation)
			if(!checkGenIsShown(step.generation))
				continue;
			var x = canvasObj.xIndex - 1;
			var y = canvasObj.yIndex - 1;
			var coords = coordinateTransform(canvasObj, step.x[x], step.x[y]);
			x = coords.x;
			y = coords.y;
			// Check if point's physical coordinates match the click
			if(offsetX - areaX < x && x < offsetX + areaX && offsetY - areaY  < y && y < offsetY + areaY) {
				matchedSteps.push(evolutionUtil.clone(step));
			}
		}
		return matchedSteps;
	}

	/*
	* Find the correct canvas in the canvas array
	* @param object 	canvas 		Javascript DOM canvas object
	*/
	function findCanvasInArr(canvas) {
		for(var i in CANVAS_ARR) {
			var item = CANVAS_ARR[i];
			if(canvas === item.bgCanvas[0]) {
				return item;
			}
		}
		return undefined;
	}


	/*
	* Displays text with point details on a canvas
	* @param string 	msg 			Info text
	* @param object 	canvasObj 		Canvas object
	*/
	function displayPointInfo(msg, canvasObj) {
		clearPointInfo(canvasObj);
		var ctx = canvasObj.infoLayerCtx;
		var x = 35;
		var y = 10;
		var lineheight = 15;
		var lines = msg.split('\n');
		ctx.fillStyle = '#FF0000';
		for (var i = 0; i < lines.length; i++)
			ctx.fillText(lines[i], x, y + (i * lineheight));
	}

 	/*
 	* Clears info text
	* @param object 	canvasObj 		Canvas object
	*/
	function clearPointInfo(canvasObj) {
		var ctx = canvasObj.infoLayerCtx;
		ctx.clearRect(0, 0, canvasObj.width, canvasObj.height);
	}



	/*
	* Bind events
	*/
	function bindEvents() {
		$.each(CANVAS_ARR, function(key, value){
			var $canvas = this.menuCanvas;
			$canvas
			.off('click')
			.on('click', function(e){
				e.preventDefault();
				//We are on the menu layer canvas, find the background canvas by going to the canvasStack div wrapper and from there to the previous, parent, canvas
				var canvasEl = $(e.currentTarget).closest('div').prev();

				var canvas = findCanvasInArr(canvasEl[0]);
				var oX = e.offsetX;
				var oY = e.offsetY;

				// Menu button
				if( oX < 30 && oY < 30) {
					menuButtonClicked(canvas);
					// Do not trigger controls if menu was clicked
					return;
				}

				// Implementation of controls
				var cw = canvas.width;
				var ch = canvas.height;
				// Top left corner is play/stop
				if(oX < cw/2 && oY < ch/2) {
					if(isPlaying())
						stop();
					else
						play();
				}

				// Top right corner is generation step forward
				if(oX > cw/2 && oY < ch/2) {
					moveOneGenerationForward();
				}
				// Bottom left is step backward
				if(oX < cw/2 && oY > ch/2) {
					moveOneStepBackward();
				}
				// Bottom right is step forward
				if(oX > cw/2 && oY > ch/2) {
					moveOneStepForward();
				}
			});
			/*.off('contextmenu')
			.on('contextmenu', function(e) {
				e.preventDefault();
				// TODO: contextmenu click on points!
			});*/
			// Mousemove event for displaying menu button
			$canvas
			.off('mousemove')
			.on('mousemove', function(e){
				e.preventDefault();
				var canvasCtx = this.getContext('2d');

				var oX = e.offsetX;
				var oY = e.offsetY;
				// Menu icon will be in the top left corner, for ease of calculation
				if( oX < 30 && oY < 30) {
					menuButtonShow(canvasCtx, true);
				} else {
					menuButtonShow(canvasCtx, false);
				}

				// Display info about points
				var canvasObj = findCanvasInArr($(e.currentTarget).closest('div').prev()[0]);
				var clickedPoints = findPointsOnClick(oX, oY, canvasObj);
				var msg = 'Podatki o točki/točkah: \n';
				for(var i in clickedPoints) {
					var p = clickedPoints[i];
					msg += 'Id: ' + p.id + ', Fitness: ' + p.fitness.toFixed(3) + ', Generation: ' + p.generation + '\n' ;
				}
				if(clickedPoints.length) {
					displayPointInfo(msg, canvasObj);
				} else {
					clearPointInfo(canvasObj);
				}
			});

			$canvas
			.off('mouseleave')
			.on('mouseleave',function(e){
				menuButtonShow(this.getContext('2d'), false);
			})

		});
	}

	/*
	* Function that checks the given properties and initializes the plugin
	*/
	function initialize() {
		container.append('<div/>');
		container = container.find('div:first-child')
		container.addClass('evo-animate-container');
		// Source
		if(!props.hasOwnProperty('source')) {
			// TODO: friendlier error messages
			alert('Erorr: Source must be defined!');
			return false;
		}


		//Display
		// Defines which X-es to show on which canvas e.g.: [[x1,x2],[x2,x3]]]
		CANVAS_X_SETTING = undefined;
		if(props.hasOwnProperty('display')) {
			var display = props.display;
			if($.isArray(display)) {
				var pass = true;
				var isArray = false;
				for(var i in display) {
					var item = display[i];
					// Display should always be an array of arrays, make sure that is so here
					if($.isArray(item)) {
						isArray = true;
					} else {
						pass = false;
					}
				}
				if(pass && isArray)
					CANVAS_X_SETTING = display;
				else if(!isArray)
					CANVAS_X_SETTING = [display];
				else
					console.warn('All items within the display array must be arrays.');

			} else {
				console.warn('The display property should be an array!');
			}
		}
		// Do not check if display is set here, because sourcetype can be URL ! Create all combinations of X-es in parseinput to make sure data is loaded
		// (If display is not set, we have to create all combinations of all dimensions, but there is a chance we do not yet have the data at this point)
		// CanvasSize
		CANVAS_SIZE_SETTING = [[300,300]];
		if(props.hasOwnProperty('canvasSize')) {
			canvasSize = props.canvasSize;
			if($.isArray(canvasSize)) {
				var pass = true;
				var isArray = false;
				for(var i in canvasSize) {
					var item = canvasSize[i];
					// canvasSize should always be an array of arrays, make sure that is so here
					if($.isArray(item)) {
						isArray = true;
						if(canvasSize[i][0] < SMALLEST_CANVAS_DIM[0] || canvasSize[i][1] < SMALLEST_CANVAS_DIM[1]) {
							console.warn('Canvas size setting is too small! Problems with menu and controls might occur!');
						}
					} else {
						pass = false;
					}
				}
				if(pass && isArray){
					CANVAS_SIZE_SETTING = canvasSize;
				} else if(!isArray) {
					CANVAS_SIZE_SETTING = [canvasSize];
					if(CANVAS_SIZE_SETTING[0][0] < SMALLEST_CANVAS_DIM[0] || CANVAS_SIZE_SETTING[0][1] < SMALLEST_CANVAS_DIM[1]) {
						console.warn('Canvas size setting is too small! Problems with menu and controls might occur!');
					}
				} else {
					console.warn('All items within the canvasSize array must be arrays.');
				}

			} else {
				console.warn('The canvasSize property should be an array!');
			}


		}
		//SourceType
		var sourceType = props.hasOwnProperty('sourceType') ? props.sourceType.toLowerCase() : 'url';
		if('url' === sourceType) {
			// Load text file
			$.ajax({
				url:props.source,
				success: function (data){
					ANIMATION_DATA = parseInput(data);
					loadingCompleted();
				}
			});
		} else if('string' === sourceType) {
			ANIMATION_DATA = parseInput(props.source);
		}
		// FPS
		fps = props.hasOwnProperty('fps') ? parseInt(props.fps) : fps;
		// Shade
		USE_SHADING_HISTORY = props.hasOwnProperty('shadingHistory') ? props.shadingHistory : true;
		//PlayOnLoad
		var playOnLoad = props.hasOwnProperty('playOnLoad') ? props.playOnLoad : true;
		// Function when loading is completed, as data can be loaded from ajax.
		var loadingCompleted = function() {
			if(playOnLoad) {
				play();
			} else {
				playSetup();
			}

			// Event binds
			bindEvents();
		};
		if('string' === sourceType)
			loadingCompleted();
		//TEMPORARY GLOBALS to  allow console use!
		stepGenF = moveOneGenerationForward;
		stepGenB = moveOneGenerationBackward;
		stepF = moveOneStepForward;
		stepB = moveOneStepBackward;
		playBind = play;
		stopBind = stop;
		move_generation_n = moveToGenerationN;
		console.log(ANIMATION_DATA); // TEMP
		console.log(CANVAS_ARR); // TEMP
		return true;
	}
	// 	Initialize the plugin
	// Functions that are to be accessible from outside
	this.play = play;
	this.stop = stop;
	this.stepForward = moveOneStepForward;
	this.stepBack = moveOneStepBackward;
	this.stepGenerationForward = moveOneGenerationForward;
	this.stepGenerationBackward = moveOneGenerationBackward;
	this.stepToGenerationN = moveToGenerationN;
	return initialize() ? this : false;
};