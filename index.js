'use strict';
//==============================================================
require('dotenv').config();
const AWS = require('aws-sdk');
      AWS.config.update({region: process.env.AWS_REGION});
const lambda = new AWS.Lambda();
const multipartParser = require('lambda-multipart-parser');
//==============================================================
function runServiceByURLPath(param) {
  if(!param.inputValues) param.inputValues = {};
  param.inputValues._serviceInterface = 'urlquery';
  let _functionName = param.functionName;
  if(param.apiStage && param.apiStage !== 'prod') _functionName = `${_functionName}-${param.apiStage}`;
  //------------------------------------------------------
  let _inputValues = param.inputValues;
  console.log(`runServiceByURLPath :: param.inputValues ---------------------`);
  console.log(param.inputValues);
  // console.log(param.inputValues['get']);
  // console.log(JSON.parse(param.inputValues['get'])[param.functionName.replace('get-','')]);
  if(
    param.inputValues['get']
    &&JSON.parse(param.inputValues['get'])[param.functionName.replace('get-','')]
  )
  {
    _inputValues = JSON.parse(param.inputValues['get'])[param.functionName.replace('get-','')];
    _inputValues._serviceInterface = param.inputValues._serviceInterface;
  }
  // console.log(_inputValues);
  //------------------------------------------------------
  console.log(`${param.serviceName}-${_functionName}`);
  return new Promise((resolve, reject) => {
    lambda.invoke({
      FunctionName : `${param.serviceName}-${_functionName}`,
      InvocationType : 'RequestResponse',
      Payload: JSON.stringify(_inputValues),
      LogType : 'None'
    }, (err, output) => {
      if(err) {
        reject(err);
      } else {
        resolve(output);
      }
    });
  });
}
//==============================================================
// multiValueQueryStringParameters --> queryStringParameters
function processMultiValueQueryParam(param) {
  let _result = {};
  if(param)
  {
    let _keys = Object.keys(param);
    for(var i in _keys)
    {
      if(!_keys[i].includes('[]'))
      {
        // value is not array
        _result[_keys[i]] = param[_keys[i]][0];
      }
      else
      {
        // value is array - ex) "options[]" = [1,2,3]
        // remove [] from key string
        _result[_keys[i].replace('[]','')] = param[_keys[i]];
      }
      if(_keys.length===Number(i)+1)
      {
        return _result;
      }
    }
  }
  else
  {
    return false;
  }
}
//==============================================================
function getValueByJsonPath (jsonPath, jsonObject) {
  console.log(`*** getValueByJsonPath :: ${jsonObject} :: ${jsonPath}`);
  if(!jsonObject||!jsonPath) return false;
  let result = true;
  let pathArray = jsonPath.split('.');
  let jsonPathValue = JSON.parse(JSON.stringify(jsonObject));
  //------------------------------------------------------
  // loop
  for(let i = 0, _length_i = pathArray.length; i < _length_i; i += 1)
  {
    // console.log(pathArray[i]);
    if(jsonPathValue[pathArray[i]])
    {
      // console.log(jsonPathValue[pathArray[i]]);
      jsonPathValue = JSON.parse(JSON.stringify(jsonPathValue[pathArray[i]]));
    }
    else
    {
      // value not exist
      return false;
    }
    //------------------------------------------------------
    // at last
    if(_length_i-1===Number(i))
    {
      console.log(`*** jsonPathValue :: ${jsonObject} :: ${jsonPath}`);
      console.log(jsonPathValue);
      return jsonPathValue;
    }
  }
  return result;
}
//==============================================================
// check this request has multipart form-data(form submit through axios)
// convert mutipart request to POST request event json structure
function isMultipartFormData(event) {
  return new Promise(async (resolve, reject) => {
    function generateJsonObject(param) {
      return {[param.key]: param.object};
    }
    
    if(
      (event.headers['content-type']
      && !event.headers['content-type'].includes('multipart/form-data'))
      ||
      (event.headers['Content-Type']
      && !event.headers['Content-Type'].includes('multipart/form-data'))
    )
    {
      resolve(false);
      return;
    }
    
    const formDataEvent = await multipartParser.parse(event);
    // console.log(formDataEvent);
    let _isFormDataEventBodyJson = false;
    if(formDataEvent.path)
    {
      let jsonKeys = formDataEvent.path.split('.');
      delete formDataEvent.path;
      let eventBody = {...formDataEvent};
      //---------------------------
      // this is a - reversed loop
      // starts from max number(length), ends with 0 --> ex) 4, 3, 2, 1
      for(let i = jsonKeys.length-1, _length_i = jsonKeys.length; _length_i+i > _length_i-1; i -= 1)
      {
        eventBody = generateJsonObject({key: jsonKeys[i], object: eventBody});
      }
      //---------------------------
      _isFormDataEventBodyJson = eventBody;
    }
    resolve(_isFormDataEventBodyJson);
  });
}
//==============================================================
function isAvailableRequest(event, RequestMapper) {
  return new Promise(async (resolve, reject) => {
    //------------------------------------------------------
    let _result = false;
    for(let i = 0, _length_i = RequestMapper.length; i < _length_i; i += 1)
    {
      const mapperItem = RequestMapper[i];
      // event.path
      // event.httpMethod
      // console.log(`=================================`);
      // console.log(`${event.path} : ${mapperItem.path}`);
      // console.log(`${event.httpMethod} : ${mapperItem.httpMethod}`);
      // console.log(`${mapperItem.dataKeyStructure}`);
      
      if(
        event.httpMethod==='GET'
        &&event.path===mapperItem.path
        &&event.httpMethod===mapperItem.httpMethod
      )
      {
        //
        if(!event.pathParameters)
        {
          sendResponse({
            promise: {event: event, resolve: resolve, reject: reject},
            result: {message: event.headers.Host},
            err: false
          });
          return;
        }
        //
        _result = {
          functionName: mapperItem.handler,
          inputValues: processMultiValueQueryParam(event.multiValueQueryStringParameters),
        };
      }
      
      if(
        event.httpMethod==='POST'
        &&event.path===mapperItem.path
        &&event.httpMethod===mapperItem.httpMethod
      )
      {
        // check this request has multipart form-data(form submit through axios)
        let thisEventBodyJson = await isMultipartFormData(event);
        
        if(!thisEventBodyJson)
        {
          // this is NOT multipart form-data
          thisEventBodyJson = JSON.parse(event.body);
        }
        
        if(mapperItem.dataKeyStructure)
        {
          let _keyArray = mapperItem.dataKeyStructure.split('.');
          thisEventBodyJson = getValueByJsonPath(mapperItem.dataKeyStructure, thisEventBodyJson);
        }
        
        if(_result===false && thisEventBodyJson)
        {
          _result = {
            functionName: mapperItem.handler,
            inputValues: thisEventBodyJson
          };
        }
      }
    }
    
    resolve(_result);
  });
}
//==============================================================
function runServiceByPostKeys(param) {
  if(!param.inputValues) param.inputValues = {};
  param.inputValues._serviceInterface = 'urlpost';
  // let keyArray = param.functionName.split('-');
  console.log('param.inputValues -----------------------');
  console.log(param.inputValues);
  let _functionName = param.functionName;
  if(param.apiStage && param.apiStage !== 'prod') _functionName = `${_functionName}-${param.apiStage}`;
  return new Promise((resolve, reject) => {
    lambda.invoke({
      FunctionName : `${param.serviceName}-${_functionName}`,
      InvocationType : 'RequestResponse',
      Payload: JSON.stringify(param.inputValues),
      LogType : 'None'
    }, (err, output) => {
      if(err) {
        reject(err);
      } else {
        resolve(output);
      }
    });
  });
}
//==============================================================
function runAPIEndpoint(param) {
  return new Promise(async (resolve, reject) => {
    const protocol = param.protocol;
    const event = param.event;
    // const context = param.context;
    //------------------------------------------------------
    if(protocol.indexOf(event.headers['X-Forwarded-Proto'])<0)
    {
      sendResponse({
        promise: {event: event, resolve: resolve, reject: reject},
        result: {message:`${param.ENVJSON.MESSAGE.MSG3}`},
        err: false
      });
      return;
    }
    if(['GET','POST'].indexOf(event.httpMethod.toUpperCase())<0)
    {
      sendResponse({
        promise: {event: event, resolve: resolve, reject: reject},
        result: {message:`${param.ENVJSON.MESSAGE.MSG4}`},
        err: false
      });
      return;
    }
    //------------------------------------------------------
    // GET
    if(event.httpMethod==='GET')
    {
        //------------------------------------------------------
        let isARSResult = await isAvailableRequest(event, param.ENVJSON.REQUEST_MAPPER);
        if(!isARSResult)
        {
          sendResponse({
            promise: {event: event, resolve: resolve, reject: reject},
            result: {message:`${param.ENVJSON.MESSAGE.MSG1} - ${event.pathParameters.proxy}`},
            err: false
          });
          return;
        }
        //------------------------------------------------------
        runServiceByURLPath({
          serviceName: param.ENVJSON.SERVICE_NAME,
          functionName: isARSResult.functionName,
          inputValues: isARSResult.inputValues,
          apiStage: event.requestContext.stage
        }).then(result => {
          sendResponse({
            promise: {event: event, resolve: resolve, reject: reject},
            result: result,
            err: false
          });
        }).catch(err => {
          sendResponse({
            promise: {event: event, resolve: resolve, reject: reject},
            result: false,
            err: err
          });
        });
        return;
    }
    //------------------------------------------------------
    // POST
    if(event.httpMethod==='POST')
    {
        let isARSResult = await isAvailableRequest(event, param.ENVJSON.REQUEST_MAPPER);
        if(!isARSResult)
        {
          sendResponse({
            promise: {event: event, resolve: resolve, reject: reject},
            result: {message:`${param.ENVJSON.MESSAGE.MSG2}`},
            err: false
          });
          return;
        }
        //------------------------------------------------------
        runServiceByPostKeys({
          serviceName: param.ENVJSON.SERVICE_NAME,
          functionName: isARSResult.functionName,
          inputValues: isARSResult.inputValues,
          apiStage: event.requestContext.stage
        }).then(result => {
          sendResponse({
            promise: {event: event, resolve: resolve, reject: reject},
            result: result,
            err: false
          });
        }).catch(err => {
          sendResponse({
            promise: {event: event, resolve: resolve, reject: reject},
            result: false,
            err: err
          });
        });
        return;
    }
  });
}
//==============================================================
function sendResponse(param) {
  let response = {headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,HEAD',
    'Content-Type': 'application/json',
    'Content-Encoding': 'UTF-8',
  }};
  if(param.promise.event && param.promise.event.Records){
    response.headers = {
      'access-control-allow-origin':[{key: 'Access-Control-Allow-Origin',value: '*'}],
      'access-control-allow-methods':[{key: 'Access-Control-Allow-Methods',value: 'OPTIONS,POST,GET,HEAD'}],
      'content-type': [{key: 'Content-Type',value: 'application/json'}],
      'content-encoding': [{key: 'Content-Encoding',value: 'UTF-8'}],
    };
  }
  response.body = JSON.stringify({});
  // if(param.headers) response.headers = param.headers;
  if(param.result) response.body = JSON.stringify(param.result);
  // if(param.option && param.option.Return && param.option.Return.Type == 'ReturnTypeBodyOnly')
  // {
  //   response = param.result;
  // }
  if(param.promise.event && param.promise.event.Records) response.status = 200;
  if(param.err) param.promise.reject(param.err);
  else param.promise.resolve(response);
}
//==============================================================
// export
module.exports = {
  sendResponse,
  runAPIEndpoint
};
