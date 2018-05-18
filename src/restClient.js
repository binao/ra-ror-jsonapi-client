import {
  GET_LIST,
  GET_ONE,
  GET_MANY,
  GET_MANY_REFERENCE,
  CREATE,
  UPDATE,
  DELETE
} from "./types";

import { jsonApiHttpClient, queryParameters } from './fetch';

const transformResource = (json, data) => {
    let included = {}; // { 'type/id' => data }
    if (json.included) {
        json.included.forEach(d => included[`${d.type}:${d.id}`] = d)
    }
    const _transformResource = (data) => {
        if (!data) {
            return {}
        }
        let res = Object.assign({ id: data.id }, data.attributes);
        if (data.relationships) {
            Object.keys(data.relationships).forEach(function(key) {
                const rel = data.relationships[key];
                let attributesKey = `${key}_attributes`
                if (rel.data && rel.data.type !== undefined) { // has_one/belongs_to
                    res[key + '_id'] = rel.data.id;
                    let relData = included[`${rel.data.type}:${rel.data.id}`]
                    if (relData)
                        res[attributesKey] = _transformResource(relData)
                } else if (rel.data && rel.data[0] && rel.data[0].type !== undefined) { // has_many
                    res[attributesKey] = []
                    rel.data.forEach(d => {
                        let relData = included[`${d.type}:${d.id}`]
                        if (relData)
                            res[attributesKey].push(_transformResource(relData))
                    })
                } else if (rel.links) {
                  // if relationships have a link field
                  var link = rel.links['self'];
                  httpClient(link).then(function(response) {
                      res[key] = { data: response.json.data, count: response.json.data.length };
                      res['count'] = response.json.data.length;
                  });
                }
            });
        }
        return res
    }
    return _transformResource(data);
}

export default (apiUrl, httpClient = jsonApiHttpClient) => {
    /**
     * @param {String} type One of the constants appearing at the top if this file, e.g. 'UPDATE'
     * @param {String} resource Name of the resource to fetch, e.g. 'posts'
     * @param {Object} params The REST request params, depending on the type
     * @returns {Object} { url, options } The HTTP request parameters
     */
    const convertRESTRequestToHTTP = (type, resource, params) => {
        let url = '';
        const options = {};
        switch (type) {
        case GET_MANY_REFERENCE:
        case GET_LIST:
            const { page, perPage } = params.pagination;
            const { field, order } = params.sort;
            const { name, value } = params.filter;
            var query = {
                'page[number]': page,
                'page[size]': perPage,
            };
            Object.keys(params.filter).forEach(key =>{
                var filterField = 'filter[' + key +']';
                query[filterField] = params.filter[key];
            })
            if (type === 'GET_MANY_REFERENCE'){
                const targetFilter = 'filter[' + params.target + ']';
                query[targetFilter] = params.id;
            }
            if (order === 'ASC'){
                query.sort = field;
            }else{
                query.sort = '-' + field;
            }
            url = `${apiUrl}/${resource}?${queryParameters(query)}`;
            break;
        case GET_ONE:
            url = `${apiUrl}/${resource}/${params.id}`;
            break;
        case GET_MANY:
            const query = {'filter[id]': params.ids.toString() };
            url = `${apiUrl}/${resource}?${queryParameters(query)}`;
            break;
        case UPDATE:
            url = `${apiUrl}/${resource}/${params.id}`;
            options.method = 'PATCH';
            var attrs = {};
            Object.keys(params.data).forEach(key => attrs[key] = params.data[key]);
            const updateParams = {data:{type: resource, id: params.id, attributes: attrs}};
            options.body = JSON.stringify(updateParams);
            break;
        case CREATE:
            url = `${apiUrl}/${resource}`;
            options.method = 'POST';
            const createParams = {data: {type: resource, attributes: params.data }};
            options.body = JSON.stringify(createParams);
            break;
        case DELETE:
            url = `${apiUrl}/${resource}/${params.id}`;
            options.method = 'DELETE';
            break;
        default:
            throw new Error(`Unsupported fetch action type ${type}`);
        }
    return { url, options };
  };

  /**
   * @param {Object} response HTTP response from fetch()
   * @param {String} type One of the constants appearing at the top if this file, e.g. 'UPDATE'
   * @param {String} resource Name of the resource to fetch, e.g. 'posts'
   * @param {Object} params The REST request params, depending on the type
   * @returns {Object} REST response
   */
  const convertHTTPResponseToREST = (response, type, resource, params) => {
      const { headers, json } = response;
      switch (type) {
      case GET_MANY_REFERENCE:
      case GET_LIST:
          var jsonData = json.data.map(d => transformResource(json, d));
          jsonData._originalJSON = json;
          return { data: jsonData, total: headers.has('Total') ? headers.get('Total') : json.meta['total'] };
      case GET_MANY:
          var jsonData = json.data.map(d => transformResource(json, d));
          jsonData._originalJSON = json;
          return { data: jsonData };
      case UPDATE:
      case CREATE:
          var jsonData = transformResource(json, json.data);
          jsonData._originalJSON = json;
          return { data: jsonData };
      case DELETE:
          var jsonData = {};
          jsonData._originalJSON = json;
          return { data: jsonData };
      default:
          var jsonData = transformResource(json, json.data);
          jsonData._originalJSON = json;
          return { data: jsonData };
      }
  };

  /**
   * @param {string} type Request type, e.g GET_LIST
   * @param {string} resource Resource name, e.g. "posts"
   * @param {Object} payload Request parameters. Depends on the request type
   * @returns {Promise} the Promise for a REST response
   */
  return (type, resource, params) => {
    const { url, options } = convertRESTRequestToHTTP(type, resource, params);
    return httpClient(url, options).then(response =>
      convertHTTPResponseToREST(response, type, resource, params)
    );
  };
};
