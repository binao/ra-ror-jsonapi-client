# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [0.1.16-rc.0] - 2017-08-21
### Added
- Function transformResource in restClient
    - for to transform resources and relations

### Changed
- jsonApiHttpClient now sets headers only if they are empty
    - Affected headers: `Content-Type`, `Accept`, `Authorization`

## [0.1.15] - 2017-04-10
### Added
- Reference Field Functionality
  - for GET_MANY and GET_MANY_REFERENCE
- Merge meta data with attributes in convertHTTPResponseToREST - type GET_MANY_REFERENCE/GET_LIST.
