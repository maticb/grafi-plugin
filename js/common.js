// Temporary file for some functions, to prevent clutter in the main plugin file
// Utils
var evolutionUtil = {}; // Prevent overriding widely used "util" variable name

/*
* Loops over all items of a given string/array and triggers callback if item matches value
* @param string/array 	str 		String or array over which to loop
* @param string/integer	val 		Value to be compared with looped items
* @param function 		callback 	Callback function, triggered when item is matched with val
*/
evolutionUtil.indexOfAll = function(str, val, callback) {
	// Compare value function, in case given value is array
	function compareVal(val1) {
		if('object' === typeof val){ // If val is array
			for( var i in val) {
				if(val[i] === val1)
					return true;
			}
			return false;
		} else {
			return val === val1;
		}
	}
	var indexes = [], i;
	var prev = 0; // Last found index
	var count = 0; // Counter of matched items
	for(i = 0; i < str.length; i++){
		if (compareVal(str[i])){
			var stop = callback.call(str, i, prev, count);
			// Check if callback returned true, breaks loop
			if(true === stop)
				break;
			prev = i;
			count++;
		}
	}
}

/*
* Universal function that parses array from argument string
* @param string 	input 		String (JSON) of the given argument
*/
evolutionUtil.parseArray = function(input){
	return JSON.parse(input);
}

/*
* Clones object
* @param object 	obj 		Any given object
*/
evolutionUtil.clone = function(obj) {
	return JSON.parse(JSON.stringify(obj));
}
/*
* Creates random ID number
*/
evolutionUtil.guid = function() {
	function s4() {
		return Math.floor((1 + Math.random()) * 0x10000)
		.toString(16)
		.substring(1);
	}
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
	s4() + '-' + s4() + s4() + s4();
}


/*
* Fills a 2D array with given values
* @param array 		arr 		Given array object
* @param integer 	x 			Array width
* @param integer 	y 			Array height
* @param any 		item 		Item to fill array with
*/
evolutionUtil.fill2DArray = function(arr, x, y, item = 0) {
	arr = [];
	for(var i = 0; i < x; i++) {
		var row = [];
		for(var j = 0; j < y; j++)
			row.push(item);
		arr.push(row);
	}
	return arr;
};

/*
* Get last item of array
* @param array 		arr 		Given array object
*/
evolutionUtil.lastItem = function(arr) {
	if(arr.length > 0)
		return arr[arr.length - 1];
	return undefined;
}
