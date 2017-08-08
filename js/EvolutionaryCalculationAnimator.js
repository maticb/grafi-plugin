
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
* - source 				string	REQUIRED	URL of the source file, or raw source data, depending on the settings (read below)
* 			URL SOURCE NOT YET IMPLEMENETED!
*
* - sourceType			string 	Optional	Set type of source, defaults to "URL". Possible types: "URL", "STRING"
*
* - playOnLoad			bool	Optional	Defines if playback should start when plugin is done loading, defaults to true.
*
* - display				array	Optional	Defines how many (2 per canvas) and which X values to show
* 		Shows all combinations of X-es by default e.g.: If the problem has 3 dimensions -> [x1,x2], [x1,x3], [x2,x3]
* 		Defined as an array, where the first X is numbered as "1": [1,2]  would display a canvas elements containing a graph, showing [x1,x2]
*		To show multiple combinations define an array of arrays: [[1,2],[2,3]] -> [x1,x2] and [x2,x3]
*
* - canvasSize 			array 	Optional	Defines dimensions of each canvas seperately, or  globally.
* 		If only an array of 2 integers is set, that will be considered as the dimension for all canvases: [300,300]
* 		You can also pass an array of arrays (Identical in size to the above "display" array!) that will set dimensions for each canvas seperately
*
* - fps 				integer Optional 	Frames per second, defaults to  25
*
* - shadingHistory 		boolean Optional 	Display or hide step history with shading, defaults to true
* - fullPlayback 		boolean Optional 	Defaults to false, if set to true, playback will continue until the end of data
* - shownGenerations 	integer Optional 	Defaults to 3, defines how many generations before the current one should be shown. 0 means all generations.
* - meshColor 			string 	Optional 	Defaults to #e5e5e5, defines color of lines in the mesh on the canvas
* - meshInitialDisplay 	boolean Optional 	Defaults to false, turns on mesh on all canvases upon load if set to true
* - showPreviousLines 	boolean Optional 	Defaults to true, displays lines for steps before the last one
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
		allPixels: 90000,
		xIndex: 1, // Index of the algorithm step's X value to be displayed on this canvas's x axis
		yIndex: 1, // Same for the y axis
		shadeStartsCounter: [],
		searchedPixels: [],
		searchedAreaCounter: 0,
		menuShown: false,
		meshShown: false,
		settingsShown: false,
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
	var LAST_ADDED_GENERATION = 1; // Id of the last generation added to the rendering

	var FULL_PLAYBACK  = false; // If set to false, play button will only play animation until the end of the generation

	var PLAYBACK_STARTED_GEN = 1; // Stores the generation number on which playback was started



	// Playback FPS limiting variables
	var fps = 10;
	var fpsInterval;
	var now;
	var then;
	var elapsed;

	// Playback user settings
	var SHOWN_GENERATIONS_NUMBER = 3; // Defines number of generations to be shown on the canvas e.g.: if 3, the last 3 generations will be shown. 0 = all generations.


	// Graphic settings
	var CANVAS_BG_COLOR = '#FFFFFF';

	// Point colors
	var POINT_CURRENT_COLOR = '#FF0000';
	var POINT_PREVIOUS_GEN_COLOR = '#00FF00';
	var POINT_OLDER_COLORS = '#0000FF';

	// Line color
	var LINE_CURRENT_COLOR = '#000000';
	var LINE_PREVIOUS_COLOR = '#999999';
	var SHOW_PREVIOUS_LINES = true;


	// Menu layer globals
	var MENU_BUTTON_SHOWN = false;

	// Shading history for each canvas
	// We count the number of steps that have hit the same pixel, and add darker shades to pixels that have had more steps on them, to display algorithm search area
	var USE_SHADING_HISTORY = true;
	var CANVAS_SHADES_NUM = 10;
	var CANVAS_SHADES_COLORS = ['#E5E5E5', '#CBCBCB', '#B1B1B1', '#979797', '#7D7D7D', '#636363', '#494949', '#2F2F2F', '#151515', '#000000']; // Array of CANVAS_SHADES_NUM colors
	var CANVAS_SHADES = {}; // Array that stores numbers, at which a certain shade should start

	// Timeliine globals
	var TIMELINE_IS_SHOWN = false;
	var TIMELINE_HEIGHT = 50;
	var TIMELINE_OFFSET_BOTTOM = 10;
	var TIMELINE_COLUMN_WIDTH = 3;
	var TIMELINE_COLUMN_COLOR = '#00AA00';
	var TIMELINE_GENERATION_DIVIDER_COLOR = '#000000';
	var TIMELINE_MAX_FITNESS = -999999999;
	var TIMELINE_MIN_FITNESS = 999999999;
	var TIMELINE_FITNESS_SPAN = 0;

	// Mesh
	var MESH_COLOR = '#e5e5e5';
	var MESH_INITIAL_DISPLAY = false;


	// Playback settings that can be changed by the user
	var MESH_LINE_NUMBERS = 10;

	var JUMP_OVER_GENERATIONS_NUM = 10; // Number of generations to jump over when clicking next generation

	// Under canvas html
	var UNDER_CONTENT = ''+
	'<div class="button">'+
	'  <button>Info</button>'+
	'</div>'+
	'<div class="content">'+
	'Algorithm and problem parameters:<br/>'+
	'	<div class="alg-params"></div>'+
	'Legend:<br/>'+
	'	<div class="shades-legend"></div>'+
	'	<div>' +
	'	Point colors:<br/>' +
	'  	<div class="color-box" style="background-color:' + POINT_CURRENT_COLOR + ';"></div> - Current generation <br/>' +
	'  	<div class="color-box" style="background-color:' + POINT_PREVIOUS_GEN_COLOR + ';"></div> - Parents <br/>' +
	'  	<div class="color-box" style="background-color:' + POINT_OLDER_COLORS + ';"></div> - Older <br/>' +
	'	</div>'+
	'</div>';


	/*
	* Set problem's range, for proper scaling on the canvas, also set some timeline variables
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

			TIMELINE_MAX_FITNESS = TIMELINE_MAX_FITNESS < step.fitness ? step.fitness : TIMELINE_MAX_FITNESS;
			TIMELINE_MIN_FITNESS = TIMELINE_MAX_FITNESS > step.fitness ? step.fitness : TIMELINE_MIN_FITNESS;
		}

		// Set timeline fitness span and converted fitness
		TIMELINE_FITNESS_SPAN = TIMELINE_MIN_FITNESS < 0 ? TIMELINE_MIN_FITNESS * -1 + TIMELINE_MAX_FITNESS : TIMELINE_MAX_FITNESS;
		for(var i in data.steps){
			var step = data.steps[i];
			if(TIMELINE_MIN_FITNESS < 0)
				step.actualFitness = step.fitness + (TIMELINE_MIN_FITNESS * -1);
			else
				step.actualFitness = step.fitness;
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
			divisionOriginal = Math.round(divisionOriginal);
			if(division > 8)
				growth = true;
			var start = min;
			for(var i in shadeStarts) {
				shadeStarts[i] = Math.round(start);
				if(growth){
					start = (division * parseInt(i + 1) );
				} else {
					start += divisionOriginal;
				}
			}
		}
		CANVAS_SHADES[canvasObj.id] = shadeStarts;
		console.log("MAX:" + max); //TEMP debug
		console.log(CANVAS_SHADES[canvasObj.id]); //TEMP debug
	}

	/*
	* Calculates number of steps that have hit each pixel, to calculate proper shading values (for each canvas seperately)
	* @param object 	canvasObj 	Canvas object
	*/
	function createLegendUnderCanvas(canvasObj) {
		var $container = canvasObj.underContainer;
		var currentCanvasShades = CANVAS_SHADES[canvasObj.id];
		var html = '';
		for(var i in currentCanvasShades) {
			i = parseInt(i);
			var currentShade = currentCanvasShades[i];
			var prevShade = i - 1 >= 0 ? currentCanvasShades[i - 1] : undefined;
			// Do not show legend for shades with the same value
			if(0 === currentShade)
				continue;
			var color = CANVAS_SHADES_COLORS[i - 1]; //TODO
			if(i === currentCanvasShades.length - 1)
				html += ' < <div class="color-box" style="background-color:' + color + ';"></div> < ' + currentShade + ' < <div class="color-box" style="background-color:' + color + ';"></div>';
			else if(i !== 0 && 0 !== prevShade)
				html += ' < <div class="color-box" style="background-color:' + color + ';"></div> < ' + currentShade;
			else
				html += currentShade;
		}

		$container.find('.content .shades-legend').html(html);
	}

	/*
	* Fills information about algorithm and problem in the proper container
	* @param object 	canvasObj 	Canvas object
	*/
	function fillInfoTab(canvasObj) {
		var $container = canvasObj.underContainer;
		var d = ANIMATION_DATA;
		var html = '' +
		d.algId + ': ' + d.algName + '<br/>' +
		'Dimensions: ' + d.problemDim + '<br/>';
		// Algorithm params
		for(var i = 0; i < d.algParams.length; i++){
			if(i + 1 !== d.algParams.length)
				html += d.algParams + ', ';
			else
				html += d.algParams;
		}
		if(d.algParams.length)
			html += '<br/>';

		html += d.problemId + ': ' + d.problemName + '<br/>';
		// Problem params
		for(var i = 0; i < d.problemParams.length; i++){
			if(i + 1 !== d.problemParams.length)
				html += d.problemParams + ', ';
			else
				html += d.problemParams;
		}
		if(d.problemParams.length)
			html += '<br/>';

		$container.find('.content .alg-params').html(html);
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
		// Increment searched area
		incrementSearchedArea(canvasObj, x, y);
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
		if(counterValue > shadeStarts[0]) {
			for(var i = 1; i < shadeStarts.length; i++) {
				var shadeValue = shadeStarts[i];
				if(counterValue > prevShadeValue && counterValue  <= shadeValue) {
					return CANVAS_SHADES_COLORS[i - 1];
				}
			}
		}
		if(counterValue > evolutionUtil.lastItem(shadeStarts))
			return evolutionUtil.lastItem(CANVAS_SHADES_COLORS);
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
	* Cleares variables used for calulating searched area
	* @param object 	canvasObj 		Canvas object
	*/
	function clearSearchedArea(canvasObj) {
		canvasObj.searchedPixels = evolutionUtil.fill2DArray(canvasObj.searchedPixels, canvasObj.width + 1, canvasObj.height + 1);
		canvasObj.searchedAreaCounter = 0;
	}

	/*
	* Increments searched area, if pixel hasn't been searched yet
	* @param object 		canvasObj 		Canvas object
	* @param integer 		x 				X coordinate
	* @param integer 		y 				Y coordinate
	*/
	function incrementSearchedArea(canvasObj, x, y) {
		if(canvasObj.searchedPixels[x][y] === 0) {
			canvasObj.searchedPixels[x][y] = 1;
			canvasObj.searchedAreaCounter++;
		}
	}

	/*
	* Displays searched area information on all canvases
	*/
	function displaySearchedAreaInfo() {
		for(var i in CANVAS_ARR)
			drawSearchInfoOnCanvas(CANVAS_ARR[i]);
	}
	/*
	* Draws search area info on one canvas
	* @param object 		canvasObj 		Canvas object
	*/
	function drawSearchInfoOnCanvas(canvasObj) {
		var num = canvasObj.searchedAreaCounter / canvasObj.allPixels * 1000;
		var ctx =	canvasObj.infoLayerCtx;
		ctx.clearRect(canvasObj.width - 50, 0, 50, 20);
		// Draw text on top right corner
		ctx.fillStyle = '#000000';
		ctx.fillText('Searched:', canvasObj.width - 50, 10);
		ctx.fillText(num.toFixed(3), canvasObj.width - 50, 20);
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
			prev = prev > 0 ? prev + 1 : prev; // If previous index is above 0,
			// add 1 (because that index is the ";")
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
			// Trim empty strings/newlines and check if it is still empty,
			// in that case "continue"
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
				obj.algId = arg;
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
				obj.problemId = arg;
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
				// Because code was first designed so that the first generation is always 1,
				// add a safeguard here
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
	* @param boolean 	lastStep 		Indicates if it is the last step (of those currently rendered)
	*/
	function renderStep(x, y = 0, canvasObj, parentCoords,  drawLine = true, lastStep = false) {
		var ctx = canvasObj.renderLayerCtx;
		ctx.fillStyle = POINT_CURRENT_COLOR;
		var physicalCoords = coordinateTransform(canvasObj, x, y);
		ctx.fillRect(physicalCoords.x, physicalCoords.y, 2, 2);

		if(true === lastStep) {
			ctx.beginPath();
			ctx.arc(physicalCoords.x, physicalCoords.y, 5, 0, 2*Math.PI);
			ctx.stroke();
		}

		// Add line from the previously drawn point
		if(true === drawLine) {
			ctx.strokeStyle = false === lastStep ? LINE_PREVIOUS_COLOR : LINE_CURRENT_COLOR;
			if(true === SHOW_PREVIOUS_LINES || (false === SHOW_PREVIOUS_LINES &&  true === lastStep)) {
				for(var i in parentCoords) {
					var coords = parentCoords[i];
					prevCoords = coordinateTransform(canvasObj, coords.x, coords.y);
					ctx.beginPath();
					ctx.moveTo(prevCoords.x, prevCoords.y);
					ctx.lineTo(physicalCoords.x, physicalCoords.y);
					ctx.stroke();
				}
			}
		}
		// Increment shades
		if(isShadingHistory())
			incrementShadeOnPoint(canvasObj, physicalCoords.x, physicalCoords.y);
	}

	/*
	* Fades given points (previous generation)
	* @param object 	canvasObj 		Object with canvas data
	* @param array 		parents 	Array of parents, should always be only 2
	* @param integer 	childX 		Child's X coordinate
	* @param integer 	childY 		Child's Y coordinate
	* @param integer 	childGenId 	Child's generation ID
	*/
	function fadePoints(canvasObj, parents, childX, childY, childGenId) {
		if(!checkGenIsShown(childGenId - 1))
			return;
		var ctx = canvasObj.renderLayerCtx;
		// X and Y axis values are stored via the indexes, which start with 1 (X1 = 1)
		var x = canvasObj.xIndex - 1;
		var y = canvasObj.yIndex - 1;
		// Convert child coordinates to physical
		var physicalCoords = coordinateTransform(canvasObj, childX, childY);
		childX = physicalCoords.x;
		childY = physicalCoords.y;
		for(var i in parents) {
			var parent = parents[i];
			// Both parents get POINT_PREVIOUS_GEN_COLOR
			ctx.fillStyle = POINT_PREVIOUS_GEN_COLOR;
			physicalCoords = coordinateTransform(canvasObj, parent.x[x], parent.x[y]);
			ctx.fillRect(physicalCoords.x, physicalCoords.y, 2, 2);

			// First check if we can show parents
			if(checkGenIsShown(childGenId - 2)) {
				// Parents of these parents get POINT_OLDER_COLORS
				ctx.fillStyle = POINT_OLDER_COLORS;
				for(var i in parent.parentIds) {
					var parentsParent = -1 !== parent.parentIds[i] ? findStepById(parent.parentIds[i]) : undefined;
					if(undefined === parentsParent)
						continue;
					//TODO: ko bojo "pravi" podatki, preglej če se točke kar naprej ponavaljajo pod tem levelom parnetov
					physicalCoords = coordinateTransform(canvasObj, parentsParent.x[x], parentsParent.x[y]);
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
			step(data.steps[stepId++], false, false);
		}
		PLAY_STEP = stepId;
	}

	/*
	* Performs one step of the algorithm
	* @param object 	stepData 	Data object for the current step
	* @param bool 		lastStep 	Indicates last step (draw circle and change line color for last step)
	* @param bool 		drawLine 	Indicates whether line should be drawn, defaults to true
	*/
	function step(stepData, lastStep = false, drawLine = true) {
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
			if(true === drawLine) {
				drawLine = evolutionUtil.lastItem(RENDERED_GENERATIONS) === stepData.generation ? true : false;
			}
			renderStep(x1, x2, canvasObj, parentCoords, drawLine, lastStep);

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
	* Draws info about dimensions being rendered on certasin canvas
	* @param object 	canvasObj 		Object with canvas data
	*/
	function drawDimensionInfo(canvasObj) {
		var ctx = canvasObj.info2LayerCtx;
		var x = 'X' + canvasObj.xIndex;
		var y = 'X' + canvasObj.yIndex;
		ctx.fillStyle = '#000000';
		ctx.fillText(x, 3, 10);
		ctx.fillText(y, canvasObj.width - 20, canvasObj.height - 3);
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
		// Calculate all pixels number, to save some computation time later
		c.allPixels = parseInt(c.width) * parseInt(c.height);

		c.xIndex = parseInt(axisIds[0]);
		c.yIndex = parseInt(axisIds[1]);

		// Div container for canvas
		c.canvasContainer = $('<div></div>').addClass('evo-animate-canvas-container');
		container.append(c.canvasContainer);

		// Create a canvas element (background)
		c.bgCanvas = $('<canvas/>').height(c.height).width(c.width).attr('height', c.height).attr('width', c.width).attr('id', id);

		$(c.bgCanvas).wrap('<div class="evo-calculator-canvas-inner-container"></div>');

		c.canvasContainer.append(c.bgCanvas);
		c.bgLayerCtx = c.bgCanvas [0].getContext('2d');

		// Create canvasStack object
		c.canvasStack = new CanvasStack(id);

		// Create render layer
		var tmpID = c.canvasStack.createLayer();
		c.renderCanvas = $('#' + tmpID);
		c.renderLayerCtx = c.renderCanvas[0].getContext('2d');

		//Create layer for mesh
		tmpID = c.canvasStack.createLayer();
		c.meshCanvas = $('#' + tmpID);
		c.meshLayerCtx = c.meshCanvas[0].getContext('2d');

		// Create info layer
		tmpID = c.canvasStack.createLayer();
		c.infoCanvas = $('#' + tmpID);
		c.infoLayerCtx = c.infoCanvas[0].getContext('2d');

		//Create another info layer "layer"
		tmpID = c.canvasStack.createLayer();
		c.info2Canvas = $('#' + tmpID);
		c.info2LayerCtx = c.info2Canvas[0].getContext('2d');

		//Create menu "layer"
		tmpID = c.canvasStack.createLayer();
		c.menuCanvas = $('#' + tmpID);
		c.menuLayerCtx = c.menuCanvas[0].getContext('2d');


		// Fill shade starts counter array with zeroes
		c.shadeStartsCounter = evolutionUtil.fill2DArray(c.shadeStartsCounter, c.width + 1, c.height + 1);

		// Create div under canvas for data display
		c.underContainer = $('<div></div>').addClass('evo-animate-under');
		c.underContainer.html(UNDER_CONTENT);
		c.canvasContainer.append(c.underContainer);
		c.underContainer.css('width', c.width);
		c.underContainer.css('height', c.height);

		c.settingsContainer = $('<div></div>').addClass('evo-animate-settings');
		c.canvasContainer.append(c.settingsContainer);


		// Push into array
		CANVAS_ARR.push(c);

		// Draw info about dimensions being rendered on this canvas
		drawDimensionInfo(c);
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
				// Check if we should only play until the end of generation
				var currentGen = ANIMATION_DATA.steps.length > PLAY_STEP ? ANIMATION_DATA.steps[PLAY_STEP].generation : PLAYBACK_STARTED_GEN;
				if(FULL_PLAYBACK){
					moveOneStepForward();
				} else if(PLAYBACK_STARTED_GEN === currentGen) {
					moveOneStepForward();
				} else {
					stop();
					return;
				}
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
	* @param boolean 	drawLines 			Indicates whether lines should be drawn or not
	*/
	var renderGenerations = function(lastGenId = -1, lastGenStepId = -1, drawLines = true) {
		if(lastGenId < 0) {
			// This should be unreachable code, checks are already done outside
			console.log('Generation ID was below 0!');
			return;
		}
		// Clear canvases
		for(var i in CANVAS_ARR) {
			var c = CANVAS_ARR[i];
			c.bgLayerCtx.clearRect(0, 0, c.width, c.height);
			c.renderLayerCtx.clearRect(0, 0, c.width, c.height);
			// Clear shades counter
			c.shadeStartsCounter = evolutionUtil.fill2DArray(c.shadeStartsCounter, c.width + 1, c.height + 1);
			// Clear searched pixels
			clearSearchedArea(c);
			if(checkTimelineShown()) {
				renderTimeline(c);
			}
		}

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
			// We shall draw a circle on the last step
			if(startStep !== lastGenStepId - 1) {
				step(ANIMATION_DATA.steps[startStep], false, drawLines);
			} else {
				step(ANIMATION_DATA.steps[startStep], true === drawLines ? true : false, drawLines);
			}
		}
		PLAY_STEP = startStep;
		displaySearchedAreaInfo();
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

			//Add one generation
			RENDERED_GENERATIONS.push(LAST_ADDED_GENERATION);
			// Delete one, if there are more in the array than it is set in SHOWN_GENERATIONS_NUMBER
			if(RENDERED_GENERATIONS.length > SHOWN_GENERATIONS_NUMBER && 0 !== SHOWN_GENERATIONS_NUMBER) {
				RENDERED_GENERATIONS.splice(0,1);
			}
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
			// Draw mesh if it's set for inital display
			if(true === MESH_INITIAL_DISPLAY) {
				drawMesh(newCanvas);
			}
			// Calculate shades for this canvas
			calculateShades(ANIMATION_DATA, newCanvas);
			createLegendUnderCanvas(newCanvas);
			fillInfoTab(newCanvas);
		}
		// Put the first generation into the proper array
		RENDERED_GENERATIONS = [1];
		// Reset some vars
		LAST_ADDED_GENERATION = 1;
		PLAYBACK_STARTED_GEN = 1;
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
			// Store generation we are starting on
			PLAYBACK_STARTED_GEN = PLAY_STEP > -1 ? ANIMATION_DATA.steps[PLAY_STEP].generation : 1;
			// If we are on the end of one generation, set start to next generation
			if(ANIMATION_DATA.steps.length > PLAY_STEP + 1) {
				PLAYBACK_STARTED_GEN = PLAYBACK_STARTED_GEN !==  ANIMATION_DATA.steps[PLAY_STEP + 1].generation ? ANIMATION_DATA.steps[PLAY_STEP + 1].generation : PLAYBACK_STARTED_GEN;
			}
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
		renderGenerations(i, 0, false);
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
				renderGenerations(num, -1, false);
			} else {
				setRenderedGenerations(num);
				renderGenerations(num, -1, false);
			}
		} else {
			console.warn('Error: Generation number out of bounds! Last generation: ' + ANIMATION_DATA.lastGeneration);
		}
	}

	/*
	* Move N generations forward
	* @param integer 	num 	Number of generations to skip, defaults to the global JUMP_OVER_GENERATIONS_NUM variable
	*/
	var jumpNGenerations = function(num = JUMP_OVER_GENERATIONS_NUM) {
		// Make sure step with ID PLAY_STEP exsists, probably an unnecessary guard
		var currentStepGen = ANIMATION_DATA.steps[PLAY_STEP] ? ANIMATION_DATA.steps[PLAY_STEP].generation : evolutionUtil.lastItem(ANIMATION_DATA.steps).generation;
		num = currentStepGen +  parseInt(num);
		// If we get a number higher than the last generation, jump to last generation
		num = evolutionUtil.lastItem(ANIMATION_DATA.steps).generation < num ? evolutionUtil.lastItem(ANIMATION_DATA.steps).generation : num;
		moveToGenerationN(num);
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
		// Physical coordinates cannot be negative,
		// if problem range goes below 0 add the difference to produce only positive numbers
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
	* Checks if timeline is shown
	*/
	function checkTimelineShown() {
		return true === TIMELINE_IS_SHOWN ? true : false;
	}

	/*
	* Calulates shown steps on the timeline
	* @param integer 	cWidth 				Width of canvas that timeline is to be rendered on
	* @return returns object with starting and ending step number
	*/
	function calculateTimelineSteps(cWidth) {
		var currentStep = PLAY_STEP;
		var lastStep = ANIMATION_DATA.steps.length;
		var startStep = 0;
		var endStep = 0;

		var shownStepsNum = cWidth / TIMELINE_COLUMN_WIDTH;

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
	*/
	function renderColumn(ctx, x, y, colH, colO) {
		ctx.fillStyle = TIMELINE_COLUMN_COLOR;
		ctx.fillRect(x, y + colO, TIMELINE_COLUMN_WIDTH, colH);
	}

	/*
	* Renders timeline to given context
	* @param object 	canvasObj 			Canvas context object
	*/
	function renderTimeline(canvasObj) {
		// First clear timeline
		clearTimeline(canvasObj);
		var ctx = canvasObj.infoLayerCtx;
		// Get starting and ending step numbers
		var start = calculateTimelineSteps(canvasObj.width);
		var end = start.end;
		start = start.start;

		// Starting position for rendering
		var startX = 0;
		var startY = canvasObj.height - TIMELINE_HEIGHT - TIMELINE_OFFSET_BOTTOM;
		var prevGen = -1;

		for(var i = start; i < end; i++) {
			var stepData = ANIMATION_DATA.steps[i];
			var fitness = stepData.actualFitness;
			// Transform fitness to a smaller scale
			var columnHeight = (fitness / TIMELINE_FITNESS_SPAN) * TIMELINE_HEIGHT;
			var columnOffset = TIMELINE_HEIGHT  - columnHeight;
			columnHeight = columnHeight < 2 ? 2 : columnHeight;// Set column height to be at least 2 pixels
			renderColumn(ctx, startX, startY, columnHeight, columnOffset);
			// Add line when new generation starts
			if(prevGen > 0 ) {
				if(prevGen !== stepData.generation) {
					ctx.fillStyle = TIMELINE_GENERATION_DIVIDER_COLOR;
					ctx.fillRect(startX, startY, 2, TIMELINE_HEIGHT);
				}
			}
			prevGen = stepData.generation;
			startX += TIMELINE_COLUMN_WIDTH;
		}
	}

	/*
	* Clears timeline
	* @param object canvasObj 	Canvas object
	*/
	function clearTimeline(canvasObj) {
		var ctx = canvasObj.infoLayerCtx;
		ctx.clearRect(0, canvasObj.height - TIMELINE_HEIGHT - TIMELINE_OFFSET_BOTTOM, canvasObj.width, TIMELINE_HEIGHT + TIMELINE_OFFSET_BOTTOM);
	}
	/*
	* Clears all timelines
	*/
	function clearAllTimelines() {
		for(var i in CANVAS_ARR) {
			clearTimeline(CANVAS_ARR[i]);
		}
	}


	/*
	* Draws or clears background mesh
	* @param object 	canvasObj 	Canvas context object
	*/
	function drawMesh(canvasObj) {
		var ctx = canvasObj.meshLayerCtx;

		if(checkMeshShown(canvasObj)) {
			ctx.clearRect(0, 0, canvasObj.width, canvasObj.height);
			canvasObj.meshShown = false;
			return;
		}

		// Subtract 1, which is the left/up side border
		var lineMarginX = parseFloat(canvasObj.width) / (MESH_LINE_NUMBERS - 1);
		var lineMarginY = parseFloat(canvasObj.height) / (MESH_LINE_NUMBERS - 1);

		var x = lineMarginX;
		var y = lineMarginY;
		// We loop for 1 less, because 1 is a border (right/bottom)
		for(var i = 0; i < MESH_LINE_NUMBERS - 1; i++) {
			drawLine(ctx, x, 0, x, canvasObj.height, MESH_COLOR);
			drawLine(ctx, 0, y, canvasObj.width, y, MESH_COLOR);
			x += lineMarginX;
			y += lineMarginY;
		}
		canvasObj.meshShown = true;
	}
	/**
	* Function draws a line from point to point
	* @param  object 	ctx 	Canvas context
	* @param  integer 	x 		Starting point X value
	* @param  integer 	y 		Starting point Y value
	* @param  integer 	x1 		End point X value
	* @param  integer 	y1 		End point Y value
	* @param  String	color 	Line color, defaults to black
	*/
	function drawLine(ctx, x = 0, y = 0, x1 = 0, y1 = 0, color = '#000000') {
		ctx.strokeStyle = color;
		ctx.beginPath();
		ctx.moveTo(x,y);
		ctx.lineTo(x1,y1);
		ctx.stroke();
	}

	/*
	* Checks if mesh is shown
	* @param object 	canvasObj 	Canvas object to draw menu on
	*/
	function checkMeshShown(canvasObj) {
		return true === canvasObj.meshShown ? true : false;
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
			var img = container.find('.img-btn-menu')[0];
			ctx.drawImage(img, 1, 1, 30, 30);
			MENU_BUTTON_SHOWN = true;
		} else {
			ctx.clearRect(0,0,31,31);
			MENU_BUTTON_SHOWN = false;
		}
	}

	/*
	* Function checks if menu is shown on given canvas object
	* @param object 	canvasObj 	Canvas object to draw menu on
	*/
	function checkMenuShown(canvasObj) {
		return true === canvasObj.menuShown ? true : false;
	}

	/*
	* Function that displays menu when clicking on the show menu button
	* @param object 	canvasObj 	Canvas object to draw menu on
	* @param boolean 	hdieOnly 	If set to true, only hide menu
	*/
	function menuButtonClicked(canvasObj, hideOnly = false) {
		if(!checkMenuShown(canvasObj) && false === hideOnly) {
			canvasObj.menuShown = true;
			showHideMenu(canvasObj.menuShown, canvasObj);
		} else {
			canvasObj.menuShown = false;
			showHideMenu(canvasObj.menuShown, canvasObj);
		}
	}

	/*
	*
	* Function that shows/hides menu menu
	* @param boolean 	show 	Show menu if true, else hide
	* @param object 	canvasObj 	Canvas object to draw menu on
	*/
	function showHideMenu(show = true, canvasObj) {
		var ctx = canvasObj.menuLayerCtx;
		var cw = canvasObj.width;
		var ch = canvasObj.height;
		if(show) {
			var midPointW = cw / 2;
			var midPointH = ch / 2;

			// Only draw 2 rectangles to show grid for menu
			//ctx.strokeStyle = '#FF0000';
			//ctx.strokeRect(midPointW, 0, cw, midPointH);
			//ctx.strokeRect(0, midPointH, midPointW, ch);

			// Top left corner is play/stop
			var coords = findCenterOfCorner(canvasObj, 'tl');
			drawImageOnCanvas(ctx, 'img-btn-play', coords.xMid, coords.yMid);

			// Top right corner is generation step forward
			coords = findCenterOfCorner(canvasObj, 'tr');
			drawImageOnCanvas(ctx, 'img-btn-step-gen', coords.xMid, coords.yMid);

			// Bottom left is step backward
			coords = findCenterOfCorner(canvasObj, 'bl');
			drawImageOnCanvas(ctx, 'img-btn-step-back', coords.xMid, coords.yMid);


			// Bottom right is step forward
			coords = findCenterOfCorner(canvasObj, 'br');
			drawImageOnCanvas(ctx, 'img-btn-step-forward', coords.xMid, coords.yMid);

			// Button(s) on the bottom
			// 1px is border, 31 = 1 brder + 20 font size + 5 padding on top and bottom
			// Settings
			drawImageOnCanvas(ctx, 'img-btn-settings', 2, canvasObj.height -52, false);
			// Mesh
			drawImageOnCanvas(ctx, 'img-btn-mesh', canvasObj.width - 52, canvasObj.height -52, false);



		} else {
			settingsShowHide(canvasObj, true);
			ctx.clearRect(0, 0, cw, ch);
		}
	}

	/*
	* Function that finds the corners and center values of  a (1/4) corner on the canvas
	* @param object 	canvasObj 	Canvas context object
	* @param string 	corner 		String defining corner: tl | tr | bl | br (Top Left, Top Right etc.)
	* @return object 				Returns an object containint the boundaries and mid point of given corner
	*/
	function findCenterOfCorner(canvasObj, corner) {
		var cw = parseFloat(canvasObj.width);
		var ch = parseFloat(canvasObj.height);
		// Object containig all coordinates in a corner
		var rtrn = {
			xStart: 0,
			xEnd: cw,
			yStart: 0,
			yEnd: ch,
			xMid: 0,
			yMid: 0,
		};
		var midPointW = cw / 2;
		var midPointH = ch / 2;
		switch(corner.toLowerCase()) {
			case 'tl': {
				rtrn.xEnd = midPointW;
				rtrn.yEnd = midPointH;
				rtrn.xMid = rtrn.xEnd / 2;
				rtrn.yMid = rtrn.yEnd / 2;
				break;
			}
			case 'tr': {
				rtrn.xStart = midPointW;
				rtrn.yEnd = midPointH;
				rtrn.xMid = rtrn.xEnd * 0.75;
				rtrn.yMid = rtrn.yEnd / 2;
				break;
			}
			case 'bl': {
				rtrn.xEnd = midPointW;
				rtrn.yStart = midPointH;
				rtrn.xMid = rtrn.xEnd / 2;
				rtrn.yMid = rtrn.yEnd * 0.75 ;
				break;
			}
			case 'br': {
				rtrn.xStart = midPointW;
				rtrn.yStart = midPointH;
				rtrn.xMid = rtrn.xEnd * 0.75 ;
				rtrn.yMid = rtrn.yEnd * 0.75 ;
				break;
			}
		}

		return rtrn;
	}

	/*
	* Function that draws an image on the given coordinates
	* @param object 	ctx 		Canvas context object
	* @param string 	imgClass 	Image class name
	* @param int/float 	x 			X coordinate where the middle of the text shall be
	* @param int/float 	y 			Y coordinate where the middle of the text shall be
	* @param boolean 	center		Indicates whether the given coordinates should be the center of the box
	*/
	function drawImageOnCanvas(ctx, imgClass, x, y, center = true) {
		var img = container.find('.' + imgClass)[0];

		if(true === center) {
			x = x - parseInt(img.naturalWidth)  / 2;
			y = y - parseInt(img.naturalHeight) / 2;
		}
		ctx.drawImage(img, x, y);
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

		var tmpLastStep = GENERATION_STARTS[evolutionUtil.lastItem(RENDERED_GENERATIONS)];
		if(undefined === tmpLastStep)
			tmpLastStep  = ANIMATION_DATA.steps.length;
		var lastStep = 0 === SHOWN_GENERATIONS_NUMBER ? ANIMATION_DATA.steps.length :  tmpLastStep;

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
		var maxLines = (canvasObj.height - TIMELINE_HEIGHT - TIMELINE_OFFSET_BOTTOM) / lineheight - 1;
		for (var i = 0; i < lines.length; i++) {
			if(i >= maxLines)
				break;
			ctx.fillText(lines[i], x, y + (i * lineheight));
		}
	}

 	/*
 	* Clears info text
	* @param object 	canvasObj 		Canvas object
	*/
	function clearPointInfo(canvasObj) {
		var ctx = canvasObj.infoLayerCtx;
		// Dont clear timeline
		var bottom =  canvasObj.height - TIMELINE_HEIGHT - TIMELINE_OFFSET_BOTTOM;
		ctx.clearRect(0, 0, canvasObj.width, bottom);
		// Because we cleared the info layer, draw search info again
		drawSearchInfoOnCanvas(canvasObj);
	}

	/**
	* Shows or hides settings
	* @param  object 	canvassObj 	Canvas context object
	* @param  boolean  	hideOnly 	Flag, defines if we should only try to hide settings, if they are shown
	*/
	function settingsShowHide(canvasObj, hideOnly = false) {
		if(!checkSettingsShown(canvasObj) && !hideOnly) {
			canvasObj.settingsContainer.css('display', 'block');
			setSettingsPosition(canvasObj);
			fillSettingsContainer(canvasObj.settingsContainer);
			bindSettingsEvents(canvasObj);
			canvasObj.settingsShown = true;
		} else {
			canvasObj.settingsContainer.css('display', 'none');
			canvasObj.settingsShown = false;
		}
	}

	/**
	* Calculates and sets settings position on given canvas
	* Settings popup: 	width:180px; height:94px;
	* @param  object 	canvassObj 	Canvas context object
	*/
	function setSettingsPosition(canvasObj) {
		var $container = canvasObj.settingsContainer;
		var midPointW = canvasObj.width / 2;
		var midPointH = canvasObj.height / 2;
		midPointW -= 90;
		midPointH -= 52;
		$container.css('left', midPointW);
		$container.css('top', midPointH);
	}


	/*
	* Function binds events for editing settings
	* @param object 	canvasObj 	Canvas context object
	*/
	function bindSettingsEvents(canvasObj) {
		var $container = canvasObj.settingsContainer;
		var $generationInputField =  $container.find('.settings-generations-jump');
		var $meshNumberInputField =  $container.find('.settings-mesh-number');
		var $button = $container.find('.btn-evo-animate-settings-submit');

		$button
		.off('click')
		.on('click', function() {
			var meshLinesNumber = parseInt($meshNumberInputField.val());
			if(meshLinesNumber > 100)
				meshLinesNumber = 100;
			if(meshLinesNumber < 0)
				meshLinesNumber = 10;
			var genNumber = parseInt($generationInputField.val());
			if(genNumber < 0)
				genNumber = 1;
			JUMP_OVER_GENERATIONS_NUM = genNumber;
			MESH_LINE_NUMBERS = meshLinesNumber;
			settingsShowHide(canvasObj);
		});
	}

	/*
	* Function fills settings container with HTML
	* @param object 	container 	Jquery container
	*/
	function fillSettingsContainer($container) {
		$container.html(''+
			'<table>'+
			'  <tbody>'+
			'    <tr><td>Iterations to jump:</td><td><input type="text" class="settings-generations-jump" value="' + JUMP_OVER_GENERATIONS_NUM + '" /></td></tr>'+
			'    <tr><td>Mesh lines number:</td><td><input type="text" class="settings-mesh-number" value="' + MESH_LINE_NUMBERS + '" /></td></tr>'+
			'    <tr><td></td><td><button class="btn-evo-animate-settings-submit">Save</button></td></tr>'+
			'  </tbody>'+
			'</table>');

	}

	/*
	* Function checks if settings are shown on given canvas object
	* @param object 	canvasObj 	Canvas context object
	*/
	function checkSettingsShown(canvasObj) {
		return true === canvasObj.settingsShown ? true : false;
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

				// If menu is shown, also trigger buttons
				if(checkMenuShown(canvas)) {
					if(oX < 52 && oY > ch - 52) {
						settingsShowHide(canvas);
						return;
					}
					if(oX > cw - 52 && oY > ch - 52) {
						drawMesh(canvas);
						return;
					}
				}

				// Hide settings when we clicked anywhere the canvas
				settingsShowHide(canvas, true);

				var menuBtnTrigger = false;
				// Top left corner is play/stop
				if(oX < cw/2 && oY < ch/2) {
					if(isPlaying())
						stop();
					else
						play();
					menuBtnTrigger = true;
				}

				// Top right corner is generation step forward
				if(oX > cw/2 && oY < ch/2) {
					menuBtnTrigger = true;
					jumpNGenerations();
				}
				// Bottom left is step backward
				if(oX < cw/2 && oY > ch/2) {
					menuBtnTrigger = true;
					moveOneStepBackward();
				}
				// Bottom right is step forward
				if(oX > cw/2 && oY > ch/2) {
					menuBtnTrigger = true;
					moveOneStepForward();
				}

				// If we clicked on any controls, also hide menu
				if(menuBtnTrigger) {
					menuButtonClicked(canvas, true);
				}
			});
			// Mousemove event for displaying menu button
			$canvas
			.off('mousemove')
			.on('mousemove', function(e){
				e.preventDefault();
				var canvasObj = findCanvasInArr($(e.currentTarget).closest('div').prev()[0]);
				var canvasCtx = this.getContext('2d');

				var oX = e.offsetX;
				var oY = e.offsetY;
				// Menu icon will be in the top left corner, for ease of calculation
				if( oX < 30 && oY < 30) {
					menuButtonShow(canvasCtx, true);
				} else {
					menuButtonShow(canvasCtx, false);
				}

				// Only shows timeline and point info, if menu is not displayed
				if(checkMenuShown(canvasObj))
					return;

				var timelineTop = canvasObj.height - TIMELINE_HEIGHT - TIMELINE_OFFSET_BOTTOM;
				var timelineBottom = canvasObj.height - TIMELINE_OFFSET_BOTTOM;
				// Show timeline on hover
				if(oY > timelineTop && oY < timelineBottom) {
					if(!checkTimelineShown()) {
						TIMELINE_IS_SHOWN = true;
						//renderTimeline(canvasObj);
					}
				} else if(checkTimelineShown()) {
					clearAllTimelines();
					TIMELINE_IS_SHOWN = false;
				}


				// Display info about points
				var clickedPoints = findPointsOnClick(oX, oY, canvasObj);
				var msg = 'Point information: \n';
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
				clearAllTimelines();
			});
		});

		$('.evo-animate-canvas-container .evo-animate-under .button button')
		.off('click')
		.on('click', function() {
			$this = $(this);
			$content = $this.parents('.evo-animate-under').find('.content');
			if('none' === $content.css('display'))
				$content.slideDown();
			else
				$content.slideUp();

		});
	}

	/*
	* Function that checks the given properties and initializes the plugin
	*/
	function initialize() {
		container.append('<div/>');
		container = container.find('div:first-child')
		container.addClass('evo-animate-container');
		// Add images that are needed inside canvas
		container.append('<div class="images"></div>');
		imgContainer = container.find('.images');
		imgContainer.append('<img class="img-btn-menu" src="css/imgs/btn-menu.jpg" alt="Menu" />');
		imgContainer.append('<img class="img-btn-play" src="css/imgs/btn-play.png" alt="Predvajaj" />');
		imgContainer.append('<img class="img-btn-step-gen" src="css/imgs/btn-step-gen.png" alt="Korak generacij" />');
		imgContainer.append('<img class="img-btn-step-back" src="css/imgs/btn-step-backward.png" alt="Korak nazaj" />');
		imgContainer.append('<img class="img-btn-step-forward" src="css/imgs/btn-step-forward.png" alt="Korak naprej" />');
		imgContainer.append('<img class="img-btn-settings" src="css/imgs/btn-settings.png" alt="Nastavitve" />');
		imgContainer.append('<img class="img-btn-mesh" src="css/imgs/btn-mesh.png" alt="Mreža" />');

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
		//  fullPlayback
		FULL_PLAYBACK = props.hasOwnProperty('fullPlayback') ? props.fullPlayback : false;
		// Shown generations
		SHOWN_GENERATIONS_NUMBER  = props.hasOwnProperty('shownGenerations') ? props.shownGenerations : SHOWN_GENERATIONS_NUMBER;
		//MESH COLOR
		MESH_COLOR  = props.hasOwnProperty('meshColor') ? props.meshColor : MESH_COLOR;
		// meshInitialDisplay
		MESH_INITIAL_DISPLAY = props.hasOwnProperty('meshInitialDisplay') ? props.meshInitialDisplay : MESH_INITIAL_DISPLAY;
		// showPreviousLines
		SHOW_PREVIOUS_LINES = props.hasOwnProperty('showPreviousLines') ? props.showPreviousLines : SHOW_PREVIOUS_LINES;
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