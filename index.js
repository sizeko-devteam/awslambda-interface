'use strict';
//==============================================================
require('dotenv').config();
const AWS = require('aws-sdk');
      AWS.config.update({region: process.env.AWS_REGION});
const lambda = new AWS.Lambda();
//==============================================================
// check Path is available
function isServicePath(ServicePath,path) {
  return ServicePath.includes(path);
}
//==============================================================
function runServiceByURLPath(param) {
  if(!param.inputValues) param.inputValues = {};
  param.inputValues._serviceInterface = 'urlquery';
  let _functionName = param.functionName;
  if(param.apiStage && param.apiStage !== 'prod') _functionName = `${_functionName}-${param.apiStage}`;
  //------------------------------------------------------
  let _inputValues = param.inputValues;
  console.log(`runServiceByURLPath ---------------------`);
  console.log(`param.inputValues ---------------------`);
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
function getValueByJsonPath (jsonObject, jsonPath) {
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
// check Path is available
function isAvailableRequestStructure(RequestStructure, bodyJson) {
  console.log(bodyJson);
  // let keys1 = Object.keys(bodyJson);
  let _result = false;
  for(let i = 0, _length_i = RequestStructure.length; i < _length_i; i += 1)
  {
    let _keyArray = RequestStructure[i].split('.');
    let _targetBodyValue = getValueByJsonPath(bodyJson, RequestStructure[i]);
    // console.log(RequestStructure[i]);
    // console.log(_keyArray);
    // console.log(_targetBodyValue);
    if(_result===false && _targetBodyValue)
    {
      let _targetFunctionName = _keyArray.join('-');
      // console.log(_targetFunctionName);
      _result = {
        functionName: _targetFunctionName,
        inputValues: _targetBodyValue
      };
    }
    if(_length_i-1==Number(i))
    {
      // console.log('isAvailableRequestStructure -------------------------');
      // console.log(_result);
      return _result;
    }
  }
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
  isServicePath,
  runServiceByURLPath,
  processMultiValueQueryParam,
  isAvailableRequestStructure,
  runServiceByPostKeys,
};
