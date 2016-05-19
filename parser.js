// идея взята с https://habrahabr.ru/post/224081/

;var Parser = (function(Parser){
"use strict";
Parser = Parser || {};

//мы поняли то что прочитали, но это не то, что мы хотим
function ParseError(where,what,res){
	console.assert(typeof where == 'number','in ParseError where ('+where+') is not a number')
	this.err = 1
	this.what = what; // если what - массив, то where не имеет смысла
	this.where = where;
	this.res = res; // не обязательный
}
//мы не поняли, что прочитали
function FatalError(where,what){
	console.assert(typeof where == 'number','in ParseError where ('+where+') is not a number')
	this.err = 2
	this.what = what; // если what - массив, то where не имеет смысла
	this.where = where;
}

// is result
function isGood(r){
	return typeof r === 'object' ? !r.err : r!==undefined ;
}

// is result or ParseError
function notFatal(r){
	return typeof r === 'object' ? r.err===undefined || r.err<2 : r!==undefined ;
}

function addErrMessage(r,message){
	if(!isGood(r) && r!==undefined) r.what+=message;
	return r;
}

//строка должна соответствовать паттерну от начала и до конца
//иначе ParseError(pos.x,'остались неразобранные символы',r)
function read_all(str, pos, pattern) {
	pos = {x:0}//и далее передаем всегда по ссылке
	var r = pattern(str,pos);
	if(!isGood(r))
		if(!r)
			return new FatalError(pos.x,'unknown error')
		else
			return r;
	else
		if(pos.x == str.length)		
			return r;
		else
			return new ParseError(pos.x,'unparsed chars are remained',r);
}

// основной конструктор
function Pattern(exec) {
	// если pos не передан, то строка должна соответствовать паттерну от начала и до конца
	// иначе ParseError(pos.x,'остались неразобранные символы',r)
    this.exec = function pattern_exec(str, pos/*.x*/){
		if(pos === undefined) return read_all(str,pos,exec);
		else return exec(str,pos);
	};
	// если результат - то transform, иначе - error_transform
	// можно преобразовать результат в ошибку и наоборот
    this.then = function pattern_then(transform/*(r,x)*/,error_transform/*(x,r)*/) {
		if(error_transform){
			console.assert(typeof error_transform === 'function')
			if(typeof tranform === 'function')
				return new Pattern(function pattern_then_reserr(str,pos/*.x*/){
					var x = pos.x;
					var r = exec(str, pos);
					return (!isGood(r)) ? 
						error_transform(x,r) : 
						transform(r,x);
				});
			else
				return new Pattern(function pattern_then_err(str,pos/*.x*/){
					var x = pos.x;
					var r = exec(str, pos);
					return (!isGood(r)) ? 
						error_transform(x,r) : 
						r;
				});
		}
		else if(typeof transform === 'function')
			return new Pattern(function pattern_then_res(str, pos/*.x*/) {
				var x = pos.x;
				var r = exec(str, pos);
				return (!isGood(r)) ? 
					r : 
					transform(r,x);
			});
	}
	this.norm_err = function(){
		return new Pattern()
	}
}
function Forward(){
	this.exec = function forwrd_exec(){		return this.pattern.exec.apply(this.pattern,arguments);	}
	this.then = function forward_then(){	return this.pattern.then.apply(this.pattern,arguments);	}
}


// если текст читается - возвращает его, иначе ничего
function read_txt(str, pos, text) {
	if (str.substr(pos.x, text.length) == text)	{
		pos.x += text.length;
		return text;
	}
}
function txt(text) {
    return new Pattern((str,pos)=>read_txt(str,pos,text));
}

// если regexp читается (не забываем в начале ставить ^) 
//- возвращает массив разбора ([0] - вся строка, [1]... - соответствуют скобкам из regexp)
//, иначе ничего
function read_rgx(str, pos, regexp) {
	var m;
	if (m = regexp.exec(str.slice(pos.x))){
		pos.x += m.index + m[0].length;
		return m
	}
}
//если в начале regexp не стоит ^, то она будет поставлена автомамтически
function rgx(regexp) {
	console.assert(regexp instanceof RegExp, 'в rgx передан аргумент неправильного типа');
	if(!/^\^/.test(regexp.source)){
		//console.warn('добавляю ^ в начало рег.выр-я '+regexp.source);
		regexp = new RegExp('^'+regexp.source);
	}
    return new Pattern((str,pos)=>read_rgx(str,pos,regexp));
}

// ошибку или ничего преобразует в неошибку
// позицию восстанавливает, если ошибка
function read_opt(str, pos, pattern) {
	var x = pos.x;
	var r = pattern(str, pos)
	if(!isGood(r))	{
		pos.x=x;	
		return {err:0};	//не ошибка	
	}
	return r;
}
function opt(pattern) {
    return new Pattern((str,pos)=>read_opt(str,pos,pattern.exec));
}

// читает последовательность, в случае неудачи позицию НЕ восстанавливает
//от isFatal зависит, что будет включено в ответ
function read_seq(str, pos, isFatal, patterns) {
	var res = {a:[]}; // a - array
	for (var i = 0; i < patterns.length; i++) {
		var r = { res : patterns[i](str, pos) };
		if( isFatal(res,r,i,pos.x) )
			return r.res;
	}
	return res.a;
}
function seq(isFatal/*(res//.a//,r//.res//,i,pos)*/, ...patterns) {
    return new Pattern((str,pos)=>read_seq(str,pos,isFatal,patterns.map(pattern=>pattern.exec)));
}

// какие результаты из последовательности паттернов включать в ответ
// в случае ParseError у результата устанавливает .err=1 и .what = массиву ошибок ParseError
function need_all(res/*.a*/,r/*.res*/,i,pos){ // isFatal()
	if(!notFatal(r.res))
		return true;
	if(!isGood(r.res)){
		res.a.err = 1;
		if(res.a.what)
			res.a.what.push(r.res);
		else
			res.a.what = [r.res];
	}
	res.a.push(r.res);
	return false;
}
// в случае ParseError у результата устанавливает .err=1 и .what = массиву ошибок ParseError
function need_none(res/*.a*/,r/*.res*/,i,pos){ // isFatal()
	if(!notFatal(r.res))
		return true;
	if(!isGood(r.res)){
		res.a.err = 1;
		if(res.a.what)
			res.a.what.push(r.res);
		else
			res.a.what = [r.res];
	}
	return false;
}
function need(...indexes){
	// резултат - после прочтения одного паттерна
	// ответ - результат всего seq
	if(indexes.length == 0)
		// + ВСЕ одиночные результаты добавляет в ответ как в массив
		throw 'непонятно, что включать в ответ';
	if(indexes.length == 1)
		// + единственный нужный результат становится ответом
		return function need_one(res/*.a*/,r/*.res*/,i,pos){ // isFatal()
			if(!notFatal(r.res))
				return true;
			if(!isGood(r.res)){
				res.a.err = 1;
				if(res.a.what)
					res.a.what.push(r.res);
				else
					res.a.what = [r.res];
			}
			if(i==indexes[0])	res.a = r.res;
			return false;
		}
	else
		// + добавляет результаты в заданные позиции ответа
		return function need_indexes(res/*.a*/,r/*.res*/,i,pos){ // isFatal()
			if(!notFatal(r.res))
				return true;
			if(!isGood(r.res)){
				res.err = 1;
				if(res.what)
					res.what.push(r.res);
				else
					res.what = [r.res];
			}
			var k = indexes.indexOf(i);
			if(k!=-1)	res.a[k] = r.res;
			return false;
		}
}

// в начале читает pattern, потом последовательность separated
// ответ - массив результатов паттернов
// от паттерна не требует восстанавливать позицию в случае неудачи (делает это сам)
function read_rep(str, pos, pattern, separated, min, max) {
	min = min===undefined ? 0 : min;
	max = max===undefined ? +Infinity : max;
	var res = [], x = pos.x, r = pattern(str, pos);
	var i = 1;

	if(min>0 && !isGood(r)/* && isGoog(res)*/){
		res.err = 1;
		res.where = x;
		res.what = r.what;
	}
	while (i<min && notFatal(r)) {
		if(!isGood(r) && isGoog(res)){
			res.err = 1;
			res.where = x;
			res.what = r.what;
		}
		res.push(r);
		x = pos.x;
		r = separated(str, pos/*.x*/);
		i++;
	}
	if(min>0 && !notFatal(r)){
		pos.x = x;
		return r;
	}
	if(!isGood(res) || i==1 && !isGood(r)){
		pos.x = x;
		return res;
	}
	
	while (i<max && isGood(r)) {
		res.push(r);
		x = pos.x;
		r = separated(str, pos/*.x*/);
		i++;
	}
	if(isGood(r))
		res.push(r);
	else
		pos.x = x;
	return res;
}
// читает последовательность паттернов, разделенных сепаратором
// если указан then - с его помощью обрабатываются пары seq(need(), separator, pattern)
// options = {min,max}
function rep(pattern, options, separator, then) {
	var min = options && options.min || 0;
	var max = options && options.max || +Infinity;
	console.assert(0<=min && min<=max && 1<=max);
    var separated = !separator ? pattern :
		then ? seq(need_all, separator, pattern).then(then) :
        seq(need(1), separator, pattern);

    return new Pattern((str,pos)=>read_rep(str,pos,pattern.exec,separated.exec,min,max));
}

// #todo понадобится - доделать
// то же что и rep, только допускает возможность ParseError
// в этом случае устанавливает .err = 1
function rep_more(pattern, separator) {
    var separated = !separator ? pattern :
        seq(need(1), separator, pattern);

    return new Pattern(function rep_more_pattern(str, pos/*.x*/) {
        var res = [], x = pos.x, r = pattern.exec(str, pos);
        while (notFatal(r)) {
            res.push(r);
			if(r.err) res.err = 1;
            x = pos.x;
            r = separated.exec(str, pos);
        }
		pos.x = x;
        return res;
    });
}

// перебирает паттерны с одной и той же позиции до достижения удачного результата
// от isGood зависит, будут ли собираться ошибки
function read_any(str, pos/*.x*/, isGood, patterns) {
	var errs = {a:{	err:2,//default fatal
					what:[]}}, 
		x = pos.x;
	for (var r, i = 0; i < patterns.length; i++){
		pos.x = x; // что бы у isGood была возможность выставить pos перед выходом из цикла
		r = patterns[i](str, pos)
		if( isGood(errs,r,i,pos) )
			return r;
	}
	return errs.a;
}
function any(isGood, ...patterns) {
    return new Pattern((str,pos)=>read_any(str,pos,isGood,patterns.map(pattern=>pattern.exec)));
}
//сначала надо указывать попытки удачного прочтения, 
//а только потом попытки восстановления после ошибок

//неудачные результаты собирает в what как в массив
function collect(errs/*.a*/,r,i,pos/*.x*/){ // isGood
	if(isGood(r))  return true;
	if(!r)         return false;
	errs.a.what.push(r)//collect
	return false;
}

//ничего не собирает
function notCollect(errs/*.a*/,r,i,pos/*.x*/){//isGood
	return isGood(r);
}

// #todo как понадобится - доделать
function exc(pattern, except) {
    return new Pattern(function exc_pattern(str, pos/*.x*/) {
        return !isGood(except.exec(str, pos)) && pattern.exec(str, pos);
    });
}

Parser.ParseError = ParseError;
Parser.FatalError = FatalError;
Parser.isGood = isGood;
Parser.notFatal = notFatal;
Parser.addErrMessage =  addErrMessage;
Parser.read_all = read_all
Parser.Pattern = Pattern; 
Parser.Forward = Forward;
Parser.read_txt = read_txt;
Parser.txt = txt;
Parser.read_rgx = read_rgx;
Parser.rgx = rgx;
Parser.read_opt = read_opt;
Parser.opt = opt;
Parser.read_seq = read_seq;
Parser.seq = seq;
Parser.need_all = need_all;
Parser.need_none = need_none;
Parser.need = need;
Parser.read_rep = read_rep;
Parser.rep = rep;
// #todo понадобится - доделать
Parser.rep_more = rep_more;
Parser.read_any = read_any;
Parser.any = any;
Parser.collect = collect;
Parser.notCollect = notCollect;
//Parser.exc = exc;

//alert('Parser загружен')
return Parser;
}
)()
