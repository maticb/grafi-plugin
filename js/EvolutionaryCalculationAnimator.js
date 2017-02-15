
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
* - ** RAFPolyfill.js (request animation frame polyfill, if using older browsers)
*
* Init properties (OBJECT) containing:
* - source 		string	REQUIRED	URL of the source file, or raw source data, depending on the settings (read below)
* - sourceType	string 	Optional	Set type of source, defaults to "URL". Possible types: "URL", "STRING"
* - playOnLoad	bool	Optional	Defines if playback should start when plugin is done loading, defaults to true.
* - display		array	Optional	Defines how many (2 per canvas) and which X values to show
* 		Shows all combinations of X-es by default e.g.: If the problem has 3 dimensions -> [x1,x2], [x1,x3], [x2,x3]
*		Can also display fitness: [fit, x1]
* 		Defined as an array, where the first X is numbered as "1": [1,2]  would display a canvas elements containing a graph, showing [x1,x2]
*		To show multiple combinations define an array of arrays: [[1,2],[2,3]] -> [x1,x2] and [x2,x3]
*
*	Example configuration of plugin properties:

{
	source: 'www.something.com/evolution.txt',
	sourceType: 'URL',
	playOnLoad: false,
	display: [1,2]
}

*/


$.fn.evoAnimate = function() {
	this.html('test');
};