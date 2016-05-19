function copyProps(from, to, type, names){
	if(type)
		if(type === 'without')
			for(var p in from){
				if( names.indexOf(p) == -1 )
					if(p in to)
						console.warn('property '+ p + 'already exist in destination');
					else
						to[p] = from[p]
			}
		else if(type === 'only')
			for(var p in from){
				if( names.indexOf(p) != -1 )
					if(p in to)
						console.warn('property '+ p + 'already exist in destination');
					else
						to[p] = from[p]
			}
		else
			console.assert(false,'unknown type of copying in copyProps')
	else
		for(var p in from){
			if(p in to)
				console.warn('property '+ p + 'already exist in destination');
			else
				to[p] = from[p]
		}
}

function checkPropsStrict(obj,names){
	var checked = new Array(names.length)
	for(var p in obj){
		var i = names.indexOf(p)
		if( i == -1 )
			console.warn('property '+p+' is unnecessary')
		else
			checked[i] = true;
	}
	for(var i = 0; i<names.length; i++)
		if(!checked[i])
			console.warn('property '+names[i]+' is epsent')
}

function checkProps(obj,names){
	for(var i = 0; i<names.length; i++)
		if(!(names[i] in obj))
			console.warn('property '+names[i]+' is epsent')
}

