'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _types = require('./types');

var _fetch = require('./fetch');

var transformResource = function transformResource(json, data) {
    var included = {}; // { 'type/id' => data }
    if (json.included) {
        json.included.forEach(function (d) {
            return included[d.type + ':' + d.id] = d;
        });
    }
    var _transformResource = function _transformResource(data) {
        if (!data) {
            return {};
        }
        var res = Object.assign({ id: data.id }, data.attributes);
        if (data.relationships) {
            Object.keys(data.relationships).forEach(function (key) {
                var rel = data.relationships[key];
                if (rel.data && rel.data.type !== undefined) {
                    // has_one/belongs_to
                    res[key + '_id'] = rel.data.id;
                    var relData = included[rel.data.type + ':' + rel.data.id];
                    if (relData) res[key] = _transformResource(relData);
                } else if (rel.data && rel.data[0] && rel.data[0].type !== undefined) {
                    // has_many
                    res[key] = [];
                    rel.data.forEach(function (d) {
                        var relData = included[d.type + ':' + d.id];
                        if (relData) res[key].push(_transformResource(relData));
                    });
                } else if (rel.links) {
                    // if relationships have a link field
                    var link = rel.links['self'];
                    httpClient(link).then(function (response) {
                        res[key] = { data: response.json.data, count: response.json.data.length };
                        res['count'] = response.json.data.length;
                    });
                }
            });
        }
        return res;
    };
    return _transformResource(data);
};

exports.default = function (apiUrl) {
    var httpClient = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : _fetch.jsonApiHttpClient;

    /**
     * @param {String} type One of the constants appearing at the top if this file, e.g. 'UPDATE'
     * @param {String} resource Name of the resource to fetch, e.g. 'posts'
     * @param {Object} params The REST request params, depending on the type
     * @returns {Object} { url, options } The HTTP request parameters
     */
    var convertRESTRequestToHTTP = function convertRESTRequestToHTTP(type, resource, params) {
        var url = '';
        var options = {};
        switch (type) {
            case _types.GET_MANY_REFERENCE:
            case _types.GET_LIST:
                var _params$pagination = params.pagination,
                    page = _params$pagination.page,
                    perPage = _params$pagination.perPage;
                var _params$sort = params.sort,
                    field = _params$sort.field,
                    order = _params$sort.order;
                var _params$filter = params.filter,
                    name = _params$filter.name,
                    value = _params$filter.value;

                var _query = {
                    'page[offset]': (page - 1) * perPage,
                    'page[limit]': perPage
                };
                Object.keys(params.filter).forEach(function (key) {
                    var filterField = 'filter[' + key + ']';
                    _query[filterField] = params.filter[key];
                });
                if (type === 'GET_MANY_REFERENCE') {
                    var targetFilter = 'filter[' + params.target + ']';
                    _query[targetFilter] = params.id;
                }
                if (order === 'ASC') {
                    _query.sort = field;
                } else {
                    _query.sort = '-' + field;
                }
                url = apiUrl + '/' + resource + '?' + (0, _fetch.queryParameters)(_query);
                break;
            case _types.GET_ONE:
                url = apiUrl + '/' + resource + '/' + params.id;
                break;
            case _types.GET_MANY:
                var _query = { 'filter[id]': params.ids.toString() };
                url = apiUrl + '/' + resource + '?' + (0, _fetch.queryParameters)(_query);
                break;
            case _types.UPDATE:
                url = apiUrl + '/' + resource + '/' + params.id;
                options.method = 'PATCH';
                var attrs = {};
                Object.keys(params.data).forEach(function (key) {
                    return attrs[key] = params.data[key];
                });
                var updateParams = { data: { type: resource, id: params.id, attributes: attrs } };
                options.body = JSON.stringify(updateParams);
                break;
            case _types.CREATE:
                url = apiUrl + '/' + resource;
                options.method = 'POST';
                var createParams = { data: { type: resource, attributes: params.data } };
                options.body = JSON.stringify(createParams);
                break;
            case _types.DELETE:
                url = apiUrl + '/' + resource + '/' + params.id;
                options.method = 'DELETE';
                break;
            default:
                throw new Error('Unsupported fetch action type ' + type);
        }
        return { url: url, options: options };
    };

    /**
     * @param {Object} response HTTP response from fetch()
     * @param {String} type One of the constants appearing at the top if this file, e.g. 'UPDATE'
     * @param {String} resource Name of the resource to fetch, e.g. 'posts'
     * @param {Object} params The REST request params, depending on the type
     * @returns {Object} REST response
     */
    var convertHTTPResponseToREST = function convertHTTPResponseToREST(response, type, resource, params) {
        var headers = response.headers,
            json = response.json;

        switch (type) {
            case _types.GET_MANY_REFERENCE:
            case _types.GET_LIST:
                var jsonData = json.data.map(function (d) {
                    return transformResource(json, d);
                });
                jsonData._originalJSON = json;
                return { data: jsonData, total: headers.has('Total') ? headers.get('Total') : json.meta['total'] };
            case _types.GET_MANY:
                var jsonData = json.data.map(function (d) {
                    return transformResource(json, d);
                });
                jsonData._originalJSON = json;
                return { data: jsonData };
            case _types.UPDATE:
            case _types.CREATE:
                var jsonData = transformResource(json, json.data);
                jsonData._originalJSON = json;
                return { data: jsonData };
            case _types.DELETE:
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
    return function (type, resource, params) {
        var _convertRESTRequestTo = convertRESTRequestToHTTP(type, resource, params),
            url = _convertRESTRequestTo.url,
            options = _convertRESTRequestTo.options;

        return httpClient(url, options).then(function (response) {
            return convertHTTPResponseToREST(response, type, resource, params);
        });
    };
};