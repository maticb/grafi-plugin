// Temporary file for some functions, to prevent clutter in the main plugin file
// Utils
var util = {};

/*
* Loops over all items of a given string/array and triggers callback if item matches value
* @param string/array 	str 		String or array over which to loop
* @param string/integer	val 		Value to be compared with looped items
* @param function 		callback 	Callback function, triggered when item is matched with val
*/
util.indexOfAll = function(str, val, callback) {
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
util.parseArray = function(input){
	return JSON.parse(input);
}

/*
* Check if object has property and returns it, else undefined
* Also parses property into a type if given
* @param object 	obj 		Any given object
* @param string 	propName 	Property name
* @param string 	propType 	Property type
*/
util.getProp = function(obj, propName, propType = null) {

	if(obj.hasOwnProperty(propName)) {
		var rtrn = obj[propName];
		if('integer' === propType)
			return parseInt(rtrn);
		// If no proptype is given
		return rtrn;
	}
	return undefined;
}

/*
* Clones object
* @param object 	obj 		Any given object
*/
util.clone = function(obj) {
	return JSON.parse(JSON.stringify(obj));
}
