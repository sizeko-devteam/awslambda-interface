# awslambda-interface

## 0.1.5
### modules
* sendResponse
* runAPIEndpoint

#### runAPIEndpoint()
<pre>
# API lambda function
const { runAPIEndpoint } = require("@sizeko/awslambda-interface");
const _ENVJSON = require('./env.json');
const apiResponse = await runAPIEndpoint({
  ENVJSON: _ENVJSON,            // API definition file (./env.json) required
  event: event,                 // event from AWS Lambda called by API Gateway
  context: context,             // context from AWS Lambda called by API Gateway
  protocol: ['http','https']
});
return apiResponse;
</pre>

#### env.json
API lambda function needs API definition file.
<pre>
# Example
{
  "SERVICE_NAME": "sizeko",
  "REQUEST_MAPPER": [
    {
      "path": "/",                        // event.path
      "httpMethod": "GET",                // event.httpMethod
      "handler": "get-size"               // name of lambda function to handle this request
    },
    {
      "path": "/",
      "httpMethod": "POST",
      "handler": "update-size",
      "dataKeyStructure": "update.size"   // JsonPath expression shows JSON key structures of event.body in case of POST request
    }
  ]
}
</pre>


## 0.1.0
### modules
* sendResponse
* isServicePath
* runServiceByURLPath
* processMultiValueQueryParam
* isAvailableRequestStructure
* runServiceByPostKeys


## 0.0.1
Init the package and publish to public.
