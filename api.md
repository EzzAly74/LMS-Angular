{
    "openapi": "3.0.0",
    "info": {
        "title": "2B Academy LMS API",
        "description": "RESTful API for the 2B Academy LMS. All endpoints are prefixed with /api/v1. Protected endpoints require a Sanctum bearer token (Authorization: Bearer <token>). Translatable response fields are localized via Accept-Language header (ar or en, default ar). Translatable input bodies accept {en, ar} objects.",
        "contact": {
            "name": "2B Academy API"
        },
        "version": "1.0.0"
    },
    "servers": [
        {
            "url": "/api/v1",
            "description": "API v1"
        }
    ],
    "paths": {
        "/webhooks/user/create-or-update": {
            "post": {
                "tags": [
                    "Webhooks"
                ],
                "summary": "HR webhook: create or update an employee record.",
                "description": "Called by the HR system on employee create / update. Idempotent — matches existing records by `system_id`.",
                "operationId": "9dc1d14a6cc38a6e62f9d124832b83d7",
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "system_id",
                                    "name",
                                    "email",
                                    "machine_code",
                                    "department_name"
                                ],
                                "properties": {
                                    "system_id": {
                                        "type": "integer",
                                        "example": 12345
                                    },
                                    "name": {
                                        "type": "string",
                                        "example": "Ahmed Ali"
                                    },
                                    "email": {
                                        "type": "string",
                                        "format": "email"
                                    },
                                    "phone": {
                                        "type": "string",
                                        "nullable": true
                                    },
                                    "machine_code": {
                                        "type": "string",
                                        "example": "EMP-001"
                                    },
                                    "department_name": {
                                        "type": "string",
                                        "example": "Engineering"
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Saved",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/SuccessResponse"
                                }
                            }
                        }
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                }
            }
        },
        "/webhooks/user/delete/{system_id}": {
            "delete": {
                "tags": [
                    "Webhooks"
                ],
                "summary": "HR webhook: delete an employee record by HR system_id.",
                "operationId": "00cc1cfa7454e261e5d0c5f8be0e2338",
                "parameters": [
                    {
                        "name": "system_id",
                        "in": "path",
                        "description": "HR system identifier of the employee",
                        "required": true,
                        "schema": {
                            "type": "integer"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/SuccessResponse"
                                }
                            }
                        }
                    },
                    "400": {
                        "description": "Missing system_id",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/ErrorResponse"
                                }
                            }
                        }
                    }
                }
            }
        },
        "/admins": {
            "get": {
                "tags": [
                    "Admins"
                ],
                "summary": "List admins (paginated).",
                "operationId": "61f631423591916481ac18ea5a041f39",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "$ref": "#/components/parameters/Search"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated admins",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/Admin"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Admins"
                ],
                "summary": "Create an admin.",
                "operationId": "d49c7335546d3c7dd050b42f38cd1cac",
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "name",
                                    "email",
                                    "password",
                                    "password_confirmation",
                                    "role"
                                ],
                                "properties": {
                                    "name": {
                                        "type": "string",
                                        "maxLength": 255
                                    },
                                    "email": {
                                        "type": "string",
                                        "format": "email"
                                    },
                                    "password": {
                                        "type": "string",
                                        "format": "password",
                                        "minLength": 8
                                    },
                                    "password_confirmation": {
                                        "type": "string",
                                        "format": "password"
                                    },
                                    "role": {
                                        "description": "Existing role name (Spatie).",
                                        "type": "string"
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Created",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Admin"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/admins/{admin}": {
            "get": {
                "tags": [
                    "Admins"
                ],
                "summary": "Show an admin (with roles).",
                "operationId": "9101248e11991467258bde43d2d74260",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "admin",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Admin detail",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Admin"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "put": {
                "tags": [
                    "Admins"
                ],
                "summary": "Update an admin.",
                "operationId": "32743ecd225f09ce3bdc4a0f737faede",
                "parameters": [
                    {
                        "name": "admin",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "name",
                                    "email",
                                    "role"
                                ],
                                "properties": {
                                    "name": {
                                        "type": "string",
                                        "maxLength": 255
                                    },
                                    "email": {
                                        "type": "string",
                                        "format": "email"
                                    },
                                    "password": {
                                        "type": "string",
                                        "format": "password",
                                        "nullable": true,
                                        "minLength": 8
                                    },
                                    "password_confirmation": {
                                        "type": "string",
                                        "format": "password",
                                        "nullable": true
                                    },
                                    "role": {
                                        "description": "Existing role name (Spatie).",
                                        "type": "string"
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Admin"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "delete": {
                "tags": [
                    "Admins"
                ],
                "summary": "Delete an admin.",
                "operationId": "b895ff05cbba773d7d58e1848d9f9824",
                "parameters": [
                    {
                        "name": "admin",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/articles": {
            "get": {
                "tags": [
                    "Articles"
                ],
                "summary": "List articles (paginated). Public.",
                "operationId": "853f86f122cfdddf9ae7f3811cf8482a",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "$ref": "#/components/parameters/Search"
                    },
                    {
                        "name": "type",
                        "in": "query",
                        "description": "Filter by article type.",
                        "required": false,
                        "schema": {
                            "type": "string",
                            "enum": [
                                "news",
                                "blogs",
                                "event"
                            ]
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated articles",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/Article"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            "post": {
                "tags": [
                    "Articles"
                ],
                "summary": "Create an article (admin only).",
                "operationId": "2f500cb243204a2b7fbb161c00107ebb",
                "requestBody": {
                    "required": true,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "required": [
                                    "type",
                                    "title",
                                    "description",
                                    "slug",
                                    "image"
                                ],
                                "properties": {
                                    "type": {
                                        "type": "string",
                                        "enum": [
                                            "news",
                                            "blogs",
                                            "event"
                                        ]
                                    },
                                    "title": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "description": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "slug": {
                                        "type": "string",
                                        "maxLength": 255
                                    },
                                    "date_publish": {
                                        "type": "string",
                                        "format": "date",
                                        "nullable": true
                                    },
                                    "image": {
                                        "description": "PNG/JPG/JPEG/WEBP/SVG/GIF, max 2MB.",
                                        "type": "string",
                                        "format": "binary"
                                    },
                                    "is_home": {
                                        "type": "boolean",
                                        "nullable": true
                                    },
                                    "active": {
                                        "type": "boolean",
                                        "nullable": true
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Created",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Article"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/articles/{article}": {
            "get": {
                "tags": [
                    "Articles"
                ],
                "summary": "Show an article. Public.",
                "operationId": "3b14aa73e730e8438324cf3554a477f4",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "article",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Article",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Article"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                }
            },
            "put": {
                "tags": [
                    "Articles"
                ],
                "summary": "Update an article (admin only).",
                "operationId": "941ed118a67d0bf272a621c9e448bb1d",
                "parameters": [
                    {
                        "name": "article",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "properties": {
                                    "type": {
                                        "type": "string",
                                        "enum": [
                                            "news",
                                            "blogs",
                                            "event"
                                        ]
                                    },
                                    "title": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "description": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "slug": {
                                        "type": "string",
                                        "maxLength": 255
                                    },
                                    "date_publish": {
                                        "type": "string",
                                        "format": "date",
                                        "nullable": true
                                    },
                                    "image": {
                                        "description": "PNG/JPG/JPEG/WEBP/SVG/GIF, max 2MB.",
                                        "type": "string",
                                        "format": "binary",
                                        "nullable": true
                                    },
                                    "is_home": {
                                        "type": "boolean",
                                        "nullable": true
                                    },
                                    "active": {
                                        "type": "boolean",
                                        "nullable": true
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Article"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "delete": {
                "tags": [
                    "Articles"
                ],
                "summary": "Delete an article (admin only).",
                "operationId": "5f0b120cbb487409ea8413d42c33bcc4",
                "parameters": [
                    {
                        "name": "article",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/attendance": {
            "get": {
                "tags": [
                    "Attendance"
                ],
                "summary": "Admin: paginated attendance list with optional filters.",
                "operationId": "026fa8db500ad09aca9a42504ea70ad1",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "name": "course_id",
                        "in": "query",
                        "description": "Filter by course id.",
                        "required": false,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "user_id",
                        "in": "query",
                        "description": "Filter by user id.",
                        "required": false,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "section_id",
                        "in": "query",
                        "description": "Filter by course section (group) id.",
                        "required": false,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "from",
                        "in": "query",
                        "description": "Lower bound date (inclusive) for attended_at.",
                        "required": false,
                        "schema": {
                            "type": "string",
                            "format": "date"
                        }
                    },
                    {
                        "name": "to",
                        "in": "query",
                        "description": "Upper bound date (inclusive) for attended_at.",
                        "required": false,
                        "schema": {
                            "type": "string",
                            "format": "date"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated attendance records",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/Attendance"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Attendance"
                ],
                "summary": "Admin: manually record (status=1) or remove (status=0) an attendance session for a user/course pair.",
                "operationId": "bae362fc6a0dbb1d85ff1f958924f3dc",
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "user_id",
                                    "course_id",
                                    "status"
                                ],
                                "properties": {
                                    "user_id": {
                                        "type": "integer",
                                        "example": 42
                                    },
                                    "course_id": {
                                        "type": "integer",
                                        "example": 7
                                    },
                                    "status": {
                                        "description": "true = record attendance, false = remove attendance.",
                                        "type": "boolean"
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Attendance recorded or removed",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/SuccessResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/my-attendance": {
            "get": {
                "tags": [
                    "Attendance"
                ],
                "summary": "User: list own attendance records for a specific course.",
                "operationId": "2aaf8e445b6098f80535e87e169ff30d",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course identifier",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "User's attendance records for the course",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/Attendance"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/auth/user/login": {
            "post": {
                "tags": [
                    "Auth"
                ],
                "summary": "User login (employee). Returns a Sanctum bearer token.",
                "operationId": "ce5890a53c919151599f280c4263fbec",
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "email",
                                    "password"
                                ],
                                "properties": {
                                    "email": {
                                        "type": "string",
                                        "format": "email"
                                    },
                                    "password": {
                                        "type": "string",
                                        "format": "password"
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Logged in",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "properties": {
                                                        "token": {
                                                            "type": "string"
                                                        },
                                                        "user": {
                                                            "$ref": "#/components/schemas/User"
                                                        }
                                                    },
                                                    "type": "object"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                }
            }
        },
        "/auth/user/logout": {
            "post": {
                "tags": [
                    "Auth"
                ],
                "summary": "Revoke the current user bearer token.",
                "operationId": "4c9b3f5e3aceb9249b31fddc468dcfa3",
                "responses": {
                    "200": {
                        "description": "Logged out",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/SuccessResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/auth/user/logout-all": {
            "post": {
                "tags": [
                    "Auth"
                ],
                "summary": "Revoke ALL of this user's bearer tokens (all devices).",
                "operationId": "edea6e576500e2f48d3d4df45332085e",
                "responses": {
                    "200": {
                        "description": "Logged out from all devices",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/SuccessResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/auth/user/me": {
            "get": {
                "tags": [
                    "Auth"
                ],
                "summary": "Get the authenticated user's profile (with roles).",
                "operationId": "52247c436724a9fcb71b94752ff2a36e",
                "responses": {
                    "200": {
                        "description": "Current user",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/User"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/auth/user/profile": {
            "put": {
                "tags": [
                    "Auth"
                ],
                "summary": "Update the authenticated user's profile.",
                "operationId": "81073d13b9d1ef1d35be101050aadf29",
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "properties": {
                                    "name": {
                                        "type": "string",
                                        "maxLength": 255
                                    },
                                    "phone": {
                                        "type": "string",
                                        "nullable": true,
                                        "maxLength": 50
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Profile updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/User"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/auth/admin/login": {
            "post": {
                "tags": [
                    "Auth"
                ],
                "summary": "Admin login. Returns a Sanctum bearer token bound to the admin guard.",
                "operationId": "f249123ce90f6eca627f1b046bf3bb7d",
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "email",
                                    "password"
                                ],
                                "properties": {
                                    "email": {
                                        "type": "string",
                                        "format": "email"
                                    },
                                    "password": {
                                        "type": "string",
                                        "format": "password"
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Logged in",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "properties": {
                                                        "token": {
                                                            "type": "string"
                                                        },
                                                        "admin": {
                                                            "$ref": "#/components/schemas/Admin"
                                                        }
                                                    },
                                                    "type": "object"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                }
            }
        },
        "/auth/admin/logout": {
            "post": {
                "tags": [
                    "Auth"
                ],
                "summary": "Revoke the current admin's bearer token.",
                "operationId": "61c25cb12b313be2867c839eff21b4cc",
                "responses": {
                    "200": {
                        "description": "Logged out",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/SuccessResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/auth/admin/me": {
            "get": {
                "tags": [
                    "Auth"
                ],
                "summary": "Get the authenticated admin's profile (with roles).",
                "operationId": "1985665366ff9e788dba209e6d0563a0",
                "responses": {
                    "200": {
                        "description": "Current admin",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Admin"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/auth/admin/profile": {
            "put": {
                "tags": [
                    "Auth"
                ],
                "summary": "Update the authenticated admin's profile.",
                "operationId": "63a0820409ab37459b93c15846aab946",
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "properties": {
                                    "name": {
                                        "type": "string",
                                        "maxLength": 255
                                    },
                                    "email": {
                                        "type": "string",
                                        "format": "email"
                                    },
                                    "password": {
                                        "type": "string",
                                        "format": "password",
                                        "nullable": true
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Profile updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Admin"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/categories": {
            "get": {
                "tags": [
                    "Categories"
                ],
                "summary": "List categories (paginated, admin only).",
                "operationId": "905349c8dcc756ed4312305b2f0a510d",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "$ref": "#/components/parameters/Search"
                    },
                    {
                        "name": "active",
                        "in": "query",
                        "description": "Filter by active flag.",
                        "required": false,
                        "schema": {
                            "type": "boolean"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated categories",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/Category"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Categories"
                ],
                "summary": "Create a category (admin only).",
                "operationId": "438066d23b9a9d9b6e398a8b8ec6091f",
                "requestBody": {
                    "required": true,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "required": [
                                    "name",
                                    "logo"
                                ],
                                "properties": {
                                    "name": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "active": {
                                        "type": "boolean",
                                        "nullable": true
                                    },
                                    "logo": {
                                        "description": "PNG/JPG/JPEG/WEBP/SVG, max 2MB.",
                                        "type": "string",
                                        "format": "binary"
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Created",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Category"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/categories/active": {
            "get": {
                "tags": [
                    "Categories"
                ],
                "summary": "List active categories (no pagination). Public — for frontend dropdowns.",
                "operationId": "863e799aad7298ba84f8c2e620c35f4d",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Active categories",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/Category"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        },
        "/categories/{category}": {
            "get": {
                "tags": [
                    "Categories"
                ],
                "summary": "Show a category (with courses_count).",
                "operationId": "b5b63395e1e0d0e580ae078a79a10881",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "category",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Category",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Category"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "put": {
                "tags": [
                    "Categories"
                ],
                "summary": "Update a category (admin only).",
                "operationId": "8357f79a46014f9d4b01db26f4f2500e",
                "parameters": [
                    {
                        "name": "category",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "properties": {
                                    "name": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "active": {
                                        "type": "boolean",
                                        "nullable": true
                                    },
                                    "logo": {
                                        "description": "PNG/JPG/JPEG/WEBP/SVG, max 2MB.",
                                        "type": "string",
                                        "format": "binary",
                                        "nullable": true
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Category"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "delete": {
                "tags": [
                    "Categories"
                ],
                "summary": "Delete a category (admin only).",
                "operationId": "115944d4c6fb983f286b870f68caad74",
                "parameters": [
                    {
                        "name": "category",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/certificates": {
            "get": {
                "tags": [
                    "Certificates"
                ],
                "summary": "Admin: paginated list of issued certificates, optionally filtered by course.",
                "operationId": "4754b031ce13509b9655c1cff34ade1e",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "name": "course_id",
                        "in": "query",
                        "description": "Filter certificates by course id.",
                        "required": false,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated certificates",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/Certificate"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/certificates/{courseId}": {
            "get": {
                "tags": [
                    "Certificates"
                ],
                "summary": "Admin: list all certificates issued for a specific course.",
                "operationId": "2c03d9ed1583f85b422c3c1ff2429d54",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "courseId",
                        "in": "path",
                        "description": "Course identifier",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Certificates for the course",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/Certificate"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/about": {
            "get": {
                "tags": [
                    "CMS"
                ],
                "summary": "Get the About page content. Public.",
                "operationId": "dc21f0eba07abe6cf8ec898f4b5adfae",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "About content",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/About"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            "post": {
                "tags": [
                    "CMS"
                ],
                "summary": "Update the About page content (admin only).",
                "operationId": "fc650384e0cad478a0ee2849754b3b4b",
                "requestBody": {
                    "required": true,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "properties": {
                                    "about": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "mission": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "vision": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "goals": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "image": {
                                        "description": "PNG/JPG/JPEG/WEBP, max 2MB.",
                                        "type": "string",
                                        "format": "binary",
                                        "nullable": true
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/About"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/testimonials": {
            "get": {
                "tags": [
                    "CMS"
                ],
                "summary": "List testimonials (paginated). Public.",
                "operationId": "612bdb72426c5b3f93f68480b8701e67",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated testimonials",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/Testimonial"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            "post": {
                "tags": [
                    "CMS"
                ],
                "summary": "Create a testimonial (admin only).",
                "operationId": "8e8023e3bbf167341c499d6beec9347f",
                "requestBody": {
                    "required": true,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "required": [
                                    "name",
                                    "description"
                                ],
                                "properties": {
                                    "name": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "description": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "image": {
                                        "description": "PNG/JPG/JPEG/WEBP, max 2MB.",
                                        "type": "string",
                                        "format": "binary",
                                        "nullable": true
                                    },
                                    "active": {
                                        "type": "boolean",
                                        "nullable": true
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Created",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Testimonial"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/testimonials/active": {
            "get": {
                "tags": [
                    "CMS"
                ],
                "summary": "List active testimonials (no pagination). Public.",
                "operationId": "f1e6aaef8c07668c571ebb6d05ba466f",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Active testimonials",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/Testimonial"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        },
        "/testimonials/{testimonial}": {
            "get": {
                "tags": [
                    "CMS"
                ],
                "summary": "Show a testimonial. Public.",
                "operationId": "42d3bca1b9e5dd738bb4460ea6a86268",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "testimonial",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Testimonial",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Testimonial"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                }
            },
            "put": {
                "tags": [
                    "CMS"
                ],
                "summary": "Update a testimonial (admin only).",
                "operationId": "73c8c461476858194b287b3eba77fd2a",
                "parameters": [
                    {
                        "name": "testimonial",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "properties": {
                                    "name": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "description": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "image": {
                                        "description": "PNG/JPG/JPEG/WEBP, max 2MB.",
                                        "type": "string",
                                        "format": "binary",
                                        "nullable": true
                                    },
                                    "active": {
                                        "type": "boolean",
                                        "nullable": true
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Testimonial"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "delete": {
                "tags": [
                    "CMS"
                ],
                "summary": "Delete a testimonial (admin only).",
                "operationId": "2cf19be0ddc72a84777ac21da3903536",
                "parameters": [
                    {
                        "name": "testimonial",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/assignments": {
            "get": {
                "tags": [
                    "Course Assignments"
                ],
                "summary": "List assignments for a course.",
                "operationId": "396a1d92fffd8522f036a25e1ba69c98",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Course assignments",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/CourseAssignment"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Course Assignments"
                ],
                "summary": "Create an assignment for a course (admin only). Uses multipart/form-data.",
                "operationId": "3025232119ced322227b523120b35f6e",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "required": [
                                    "title",
                                    "file"
                                ],
                                "properties": {
                                    "title": {
                                        "type": "string",
                                        "maxLength": 255
                                    },
                                    "file": {
                                        "description": "Assignment instructions file (max 20 MB).",
                                        "type": "string",
                                        "format": "binary"
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Created",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/CourseAssignment"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/assignments/{assignment}": {
            "put": {
                "tags": [
                    "Course Assignments"
                ],
                "summary": "Update an assignment (admin only). Uses multipart/form-data if uploading a new file.",
                "operationId": "608d1efe07e75efe60d44004df53a6f0",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "assignment",
                        "in": "path",
                        "description": "Assignment id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "required": [
                                    "title"
                                ],
                                "properties": {
                                    "title": {
                                        "type": "string",
                                        "maxLength": 255
                                    },
                                    "file": {
                                        "type": "string",
                                        "format": "binary",
                                        "nullable": true
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/CourseAssignment"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "delete": {
                "tags": [
                    "Course Assignments"
                ],
                "summary": "Delete an assignment (admin only).",
                "operationId": "fc8ab8dbedf534512f011906a1f7dd8d",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "assignment",
                        "in": "path",
                        "description": "Assignment id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/assignments/{assignment}/submissions": {
            "get": {
                "tags": [
                    "Course Assignments"
                ],
                "summary": "List user submissions for an assignment (admin only, paginated).",
                "operationId": "a2466ac6253bfa86eba9d029b8b9e823",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "assignment",
                        "in": "path",
                        "description": "Assignment id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated submissions",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/CourseAssignmentSubmission"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/assignments/{assignment}/submissions/{submission}/review": {
            "put": {
                "tags": [
                    "Course Assignments"
                ],
                "summary": "Review a user submission — add feedback and/or score (admin only).",
                "operationId": "7d2f0a10690781271c90b8f88a20b2c7",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "assignment",
                        "in": "path",
                        "description": "Assignment id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "submission",
                        "in": "path",
                        "description": "Submission id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "properties": {
                                    "feedback": {
                                        "type": "string",
                                        "nullable": true,
                                        "maxLength": 2000
                                    },
                                    "score": {
                                        "type": "string",
                                        "nullable": true,
                                        "maxLength": 50
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Reviewed",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/CourseAssignmentSubmission"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/assignments/{assignment}/submit": {
            "post": {
                "tags": [
                    "Course Assignments"
                ],
                "summary": "Submit (or replace) the authenticated user's file for an assignment.",
                "operationId": "8b2f085fb3349fc3eba488d72d62f864",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "assignment",
                        "in": "path",
                        "description": "Assignment id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "required": [
                                    "file"
                                ],
                                "properties": {
                                    "file": {
                                        "description": "Submission file (max 20 MB).",
                                        "type": "string",
                                        "format": "binary"
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Submitted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/CourseAssignmentSubmission"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/assignments/{assignment}/my-submission": {
            "get": {
                "tags": [
                    "Course Assignments"
                ],
                "summary": "Get the authenticated user's own submission for an assignment (null if none).",
                "operationId": "53dc629fb9c9c57020567e4aa46f5da1",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "assignment",
                        "in": "path",
                        "description": "Assignment id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "User submission (may be null)",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "oneOf": [
                                                        {
                                                            "$ref": "#/components/schemas/CourseAssignmentSubmission"
                                                        }
                                                    ],
                                                    "nullable": true
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses": {
            "get": {
                "tags": [
                    "Courses"
                ],
                "summary": "List courses (paginated, with filters).",
                "operationId": "9095506c0ebd94c1a1fd5f1c112c5f01",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "$ref": "#/components/parameters/Search"
                    },
                    {
                        "name": "category_id",
                        "in": "query",
                        "description": "Filter by category id.",
                        "required": false,
                        "schema": {
                            "type": "integer"
                        }
                    },
                    {
                        "name": "active",
                        "in": "query",
                        "description": "Filter by active flag.",
                        "required": false,
                        "schema": {
                            "type": "boolean"
                        }
                    },
                    {
                        "name": "course_type",
                        "in": "query",
                        "description": "Filter by course type (online or offline).",
                        "required": false,
                        "schema": {
                            "type": "string",
                            "enum": [
                                "online",
                                "offline"
                            ]
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated courses",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/Course"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Courses"
                ],
                "summary": "Create a course (admin only). Uses multipart/form-data for the image upload.",
                "operationId": "76a507ce45ea19857f13f15723d312c7",
                "requestBody": {
                    "required": true,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "required": [
                                    "title",
                                    "description",
                                    "category_id",
                                    "hours",
                                    "certificate",
                                    "image",
                                    "instructors"
                                ],
                                "properties": {
                                    "course_type": {
                                        "type": "string",
                                        "enum": [
                                            "online",
                                            "offline"
                                        ]
                                    },
                                    "title": {
                                        "type": "string",
                                        "maxLength": 255
                                    },
                                    "title_for_certificate": {
                                        "type": "string",
                                        "nullable": true,
                                        "maxLength": 255
                                    },
                                    "description": {
                                        "type": "string"
                                    },
                                    "category_id": {
                                        "type": "integer"
                                    },
                                    "intro_video": {
                                        "type": "string",
                                        "nullable": true
                                    },
                                    "price": {
                                        "type": "number",
                                        "format": "float",
                                        "nullable": true
                                    },
                                    "currency": {
                                        "type": "string",
                                        "nullable": true,
                                        "maxLength": 10
                                    },
                                    "hours": {
                                        "type": "integer",
                                        "minimum": 1
                                    },
                                    "language": {
                                        "type": "string",
                                        "nullable": true
                                    },
                                    "level": {
                                        "type": "string",
                                        "nullable": true
                                    },
                                    "certificate": {
                                        "type": "boolean"
                                    },
                                    "image": {
                                        "type": "string",
                                        "format": "binary"
                                    },
                                    "active": {
                                        "type": "boolean",
                                        "nullable": true
                                    },
                                    "outside_materials": {
                                        "type": "boolean",
                                        "nullable": true
                                    },
                                    "is_evaluate": {
                                        "type": "boolean",
                                        "nullable": true
                                    },
                                    "allow_attendances": {
                                        "type": "boolean",
                                        "nullable": true
                                    },
                                    "instructors": {
                                        "type": "array",
                                        "items": {
                                            "type": "integer"
                                        }
                                    },
                                    "qualification_skill_ids": {
                                        "type": "array",
                                        "items": {
                                            "type": "integer"
                                        },
                                        "nullable": true
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Created",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Course"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}": {
            "get": {
                "tags": [
                    "Courses"
                ],
                "summary": "Show a course (with sections, lectures, exams, ratings).",
                "operationId": "ff879ee6707c117d3ea55f5f146c7f8f",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Course detail",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/CourseDetail"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "put": {
                "tags": [
                    "Courses"
                ],
                "summary": "Update a course (admin only). Uses multipart/form-data when uploading a new image.",
                "operationId": "30666bb01abc1229b8b449a883622ea1",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "properties": {
                                    "course_type": {
                                        "type": "string",
                                        "enum": [
                                            "online",
                                            "offline"
                                        ]
                                    },
                                    "title": {
                                        "type": "string",
                                        "maxLength": 255
                                    },
                                    "title_for_certificate": {
                                        "type": "string",
                                        "nullable": true,
                                        "maxLength": 255
                                    },
                                    "description": {
                                        "type": "string"
                                    },
                                    "category_id": {
                                        "type": "integer"
                                    },
                                    "intro_video": {
                                        "type": "string",
                                        "nullable": true
                                    },
                                    "price": {
                                        "type": "number",
                                        "format": "float",
                                        "nullable": true
                                    },
                                    "currency": {
                                        "type": "string",
                                        "nullable": true,
                                        "maxLength": 10
                                    },
                                    "hours": {
                                        "type": "integer",
                                        "minimum": 1
                                    },
                                    "language": {
                                        "type": "string",
                                        "nullable": true
                                    },
                                    "level": {
                                        "type": "string",
                                        "nullable": true
                                    },
                                    "certificate": {
                                        "type": "boolean"
                                    },
                                    "image": {
                                        "type": "string",
                                        "format": "binary",
                                        "nullable": true
                                    },
                                    "active": {
                                        "type": "boolean",
                                        "nullable": true
                                    },
                                    "outside_materials": {
                                        "type": "boolean",
                                        "nullable": true
                                    },
                                    "is_evaluate": {
                                        "type": "boolean",
                                        "nullable": true
                                    },
                                    "allow_attendances": {
                                        "type": "boolean",
                                        "nullable": true
                                    },
                                    "instructors": {
                                        "type": "array",
                                        "items": {
                                            "type": "integer"
                                        }
                                    },
                                    "qualification_skill_ids": {
                                        "type": "array",
                                        "items": {
                                            "type": "integer"
                                        },
                                        "nullable": true
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Course"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "delete": {
                "tags": [
                    "Courses"
                ],
                "summary": "Delete a course (admin only).",
                "operationId": "aae38fb43230030ccb2bc73e80d589f1",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/exams": {
            "get": {
                "tags": [
                    "Course Exams"
                ],
                "summary": "List exams for a course.",
                "operationId": "4e28d703b81c5a1be6fed537b355b78f",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Course exams",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/CourseExam"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Course Exams"
                ],
                "summary": "Create an exam with questions and answers (admin only).",
                "operationId": "9e68ab683342bdb4ffa18cee2709f3df",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "section_id",
                                    "title",
                                    "degree",
                                    "questions"
                                ],
                                "properties": {
                                    "section_id": {
                                        "type": "integer"
                                    },
                                    "title": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "degree": {
                                        "type": "integer",
                                        "minimum": 1
                                    },
                                    "is_final": {
                                        "type": "boolean",
                                        "nullable": true
                                    },
                                    "questions": {
                                        "type": "array",
                                        "items": {
                                            "required": [
                                                "question",
                                                "answers"
                                            ],
                                            "properties": {
                                                "question": {
                                                    "$ref": "#/components/schemas/TranslatedString"
                                                },
                                                "answers": {
                                                    "type": "array",
                                                    "items": {
                                                        "required": [
                                                            "answer",
                                                            "is_correct"
                                                        ],
                                                        "properties": {
                                                            "answer": {
                                                                "$ref": "#/components/schemas/TranslatedString"
                                                            },
                                                            "is_correct": {
                                                                "type": "boolean"
                                                            }
                                                        },
                                                        "type": "object"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Created",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/CourseExam"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/exams/{exam}": {
            "get": {
                "tags": [
                    "Course Exams"
                ],
                "summary": "Show an exam with its questions and answers.",
                "operationId": "5d7060520a9612134f4be43d3536e935",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "exam",
                        "in": "path",
                        "description": "Exam id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Course exam",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/CourseExam"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "put": {
                "tags": [
                    "Course Exams"
                ],
                "summary": "Update an exam (admin only).",
                "operationId": "99503d138a0502e92c97106e86c9cab8",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "exam",
                        "in": "path",
                        "description": "Exam id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "section_id",
                                    "title",
                                    "degree",
                                    "questions"
                                ],
                                "properties": {
                                    "section_id": {
                                        "type": "integer"
                                    },
                                    "title": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "degree": {
                                        "type": "integer",
                                        "minimum": 1
                                    },
                                    "is_final": {
                                        "type": "boolean",
                                        "nullable": true
                                    },
                                    "questions": {
                                        "type": "array",
                                        "items": {
                                            "properties": {
                                                "question": {
                                                    "$ref": "#/components/schemas/TranslatedString"
                                                },
                                                "answers": {
                                                    "type": "array",
                                                    "items": {
                                                        "properties": {
                                                            "answer": {
                                                                "$ref": "#/components/schemas/TranslatedString"
                                                            },
                                                            "is_correct": {
                                                                "type": "boolean"
                                                            }
                                                        },
                                                        "type": "object"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/CourseExam"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "delete": {
                "tags": [
                    "Course Exams"
                ],
                "summary": "Delete an exam (admin only).",
                "operationId": "ed85ef8b0ff52153b49411ef5911b260",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "exam",
                        "in": "path",
                        "description": "Exam id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/lectures": {
            "get": {
                "tags": [
                    "Course Lectures"
                ],
                "summary": "List lectures for a course, grouped by section.",
                "operationId": "37b4f45c4b9413f709f6cc018554dd08",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Sections with nested lectures",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/CourseSection"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Course Lectures"
                ],
                "summary": "Create a lecture under a course section (admin only).",
                "operationId": "dcb13c4daf605c68f10fe9b139f16297",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "section_id",
                                    "title",
                                    "type",
                                    "video"
                                ],
                                "properties": {
                                    "section_id": {
                                        "type": "integer"
                                    },
                                    "title": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "type": {
                                        "type": "string",
                                        "enum": [
                                            "url",
                                            "file"
                                        ]
                                    },
                                    "video": {
                                        "description": "External URL or stored file path.",
                                        "type": "string"
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Created",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/CourseLecture"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/lectures/{lecture}": {
            "put": {
                "tags": [
                    "Course Lectures"
                ],
                "summary": "Update a lecture (admin only).",
                "operationId": "758153e67dbbb9b54a838761f210a10c",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "lecture",
                        "in": "path",
                        "description": "Lecture id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "section_id",
                                    "title",
                                    "type",
                                    "video"
                                ],
                                "properties": {
                                    "section_id": {
                                        "type": "integer"
                                    },
                                    "title": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "type": {
                                        "type": "string",
                                        "enum": [
                                            "url",
                                            "file"
                                        ]
                                    },
                                    "video": {
                                        "type": "string"
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/CourseLecture"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "delete": {
                "tags": [
                    "Course Lectures"
                ],
                "summary": "Delete a lecture (admin only).",
                "operationId": "59c4e005a15c8eaff36934beea9cdbab",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "lecture",
                        "in": "path",
                        "description": "Lecture id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/lecture-questions": {
            "get": {
                "tags": [
                    "Lecture Questions"
                ],
                "summary": "List lecture questions with optional filters (admin only, paginated).",
                "operationId": "9983d939b331923842dc1cf4a94b2285",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "name": "course_id",
                        "in": "query",
                        "description": "Filter by course id.",
                        "required": false,
                        "schema": {
                            "type": "integer"
                        }
                    },
                    {
                        "name": "lecture_id",
                        "in": "query",
                        "description": "Filter by lecture id.",
                        "required": false,
                        "schema": {
                            "type": "integer"
                        }
                    },
                    {
                        "name": "user_id",
                        "in": "query",
                        "description": "Filter by user id (asker).",
                        "required": false,
                        "schema": {
                            "type": "integer"
                        }
                    },
                    {
                        "name": "answered",
                        "in": "query",
                        "description": "Filter by answered/unanswered state.",
                        "required": false,
                        "schema": {
                            "type": "boolean"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated lecture questions",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/LectureQuestion"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/lectures/{lecture}/questions": {
            "post": {
                "tags": [
                    "Lecture Questions"
                ],
                "summary": "Submit a question on a lecture (authenticated user).",
                "operationId": "b84e8fd125fcebd072458799c2116a0d",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "lecture",
                        "in": "path",
                        "description": "Lecture id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "question"
                                ],
                                "properties": {
                                    "question": {
                                        "type": "string",
                                        "maxLength": 2000
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Question submitted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/LectureQuestion"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/lecture-questions/{question}/answer": {
            "put": {
                "tags": [
                    "Lecture Questions"
                ],
                "summary": "Post an answer to a lecture question (admin only).",
                "operationId": "4bdc028c9ceb54767b880320f570c678",
                "parameters": [
                    {
                        "name": "question",
                        "in": "path",
                        "description": "Lecture question id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "answer"
                                ],
                                "properties": {
                                    "answer": {
                                        "type": "string",
                                        "maxLength": 5000
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Answered",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/LectureQuestion"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/lecture-questions/{question}": {
            "delete": {
                "tags": [
                    "Lecture Questions"
                ],
                "summary": "Delete a lecture question (admin only).",
                "operationId": "98e937a417c2f6f13880a7143853f3fa",
                "parameters": [
                    {
                        "name": "question",
                        "in": "path",
                        "description": "Lecture question id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/ratings": {
            "get": {
                "tags": [
                    "Course Ratings"
                ],
                "summary": "List ratings for a course (admin only, paginated).",
                "operationId": "12ea0a953656310c946a862601038e66",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "user_id",
                        "in": "query",
                        "description": "Filter by user id.",
                        "required": false,
                        "schema": {
                            "type": "integer"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated ratings",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/CourseRating"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Course Ratings"
                ],
                "summary": "Submit or update the authenticated user's rating for a course.",
                "operationId": "118c4436bbb492bb12969883763a4c59",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "rating"
                                ],
                                "properties": {
                                    "rating": {
                                        "type": "integer",
                                        "maximum": 5,
                                        "minimum": 1
                                    },
                                    "review": {
                                        "type": "string",
                                        "nullable": true,
                                        "maxLength": 1000
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Rating saved",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/CourseRating"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/ratings/{rating}": {
            "delete": {
                "tags": [
                    "Course Ratings"
                ],
                "summary": "Delete a course rating (admin only).",
                "operationId": "b9cdef7631cfe6f1fc1cdc54d8027cb3",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "rating",
                        "in": "path",
                        "description": "Rating id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/sections": {
            "get": {
                "tags": [
                    "Course Sections"
                ],
                "summary": "List sections for a course (ordered).",
                "operationId": "633f964f0bb45d1223d3e7b0091dcdd2",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Course sections",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/CourseSection"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Course Sections"
                ],
                "summary": "Create a section under a course (admin only).",
                "operationId": "f43b3edf184fcc81550a48946a50fdfd",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "name"
                                ],
                                "properties": {
                                    "name": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Created",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/CourseSection"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/sections/sync": {
            "post": {
                "tags": [
                    "Course Sections"
                ],
                "summary": "Bulk replace sections for a course (admin only). Pass full list; existing sections matched by id are kept, others are deleted.",
                "operationId": "78b786e5326e90ef270eb29c90f44d11",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "sections"
                                ],
                                "properties": {
                                    "sections": {
                                        "type": "array",
                                        "items": {
                                            "required": [
                                                "name"
                                            ],
                                            "properties": {
                                                "id": {
                                                    "description": "Existing section id to update; omit to create.",
                                                    "type": "integer",
                                                    "nullable": true
                                                },
                                                "name": {
                                                    "$ref": "#/components/schemas/TranslatedString"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Synced",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/CourseSection"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/sections/{section}": {
            "put": {
                "tags": [
                    "Course Sections"
                ],
                "summary": "Update a section (admin only).",
                "operationId": "6ed8f6ac26d8fe4f89a5b64115155433",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "section",
                        "in": "path",
                        "description": "Section id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "name"
                                ],
                                "properties": {
                                    "name": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/CourseSection"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "delete": {
                "tags": [
                    "Course Sections"
                ],
                "summary": "Delete a section (admin only).",
                "operationId": "7b61ecf4998bf61966afdec9107a3cc9",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "section",
                        "in": "path",
                        "description": "Section id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/sessions": {
            "get": {
                "tags": [
                    "Course Sessions"
                ],
                "summary": "List offline course sessions (paginated, admin only).",
                "operationId": "910288be807897820c4a9343cdecbd64",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "section_id",
                        "in": "query",
                        "description": "Filter by section id.",
                        "required": false,
                        "schema": {
                            "type": "integer"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated sessions",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/CourseSession"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Course Sessions"
                ],
                "summary": "Create an offline session for a course (admin only).",
                "operationId": "6085be200489c4588ab5f8a745427823",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "section_id",
                                    "title"
                                ],
                                "properties": {
                                    "section_id": {
                                        "type": "integer"
                                    },
                                    "title": {
                                        "type": "string",
                                        "maxLength": 255
                                    },
                                    "session_date": {
                                        "type": "string",
                                        "format": "date",
                                        "nullable": true
                                    },
                                    "time_from": {
                                        "description": "HH:mm",
                                        "type": "string",
                                        "example": "09:00",
                                        "nullable": true
                                    },
                                    "time_to": {
                                        "description": "HH:mm",
                                        "type": "string",
                                        "example": "11:00",
                                        "nullable": true
                                    },
                                    "location": {
                                        "type": "string",
                                        "nullable": true,
                                        "maxLength": 255
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Created",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/CourseSession"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/sessions/{session}": {
            "put": {
                "tags": [
                    "Course Sessions"
                ],
                "summary": "Update an offline session (admin only).",
                "operationId": "bae461c42d331b24cc4b6e94884d5fe0",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "session",
                        "in": "path",
                        "description": "Session id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "section_id",
                                    "title"
                                ],
                                "properties": {
                                    "section_id": {
                                        "type": "integer"
                                    },
                                    "title": {
                                        "type": "string",
                                        "maxLength": 255
                                    },
                                    "session_date": {
                                        "type": "string",
                                        "format": "date",
                                        "nullable": true
                                    },
                                    "time_from": {
                                        "type": "string",
                                        "example": "09:00",
                                        "nullable": true
                                    },
                                    "time_to": {
                                        "type": "string",
                                        "example": "11:00",
                                        "nullable": true
                                    },
                                    "location": {
                                        "type": "string",
                                        "nullable": true,
                                        "maxLength": 255
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/CourseSession"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "delete": {
                "tags": [
                    "Course Sessions"
                ],
                "summary": "Delete an offline session (admin only).",
                "operationId": "52c64776d167c0cf97a43165d4f3b057",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "session",
                        "in": "path",
                        "description": "Session id",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/dashboard": {
            "get": {
                "tags": [
                    "Dashboard"
                ],
                "summary": "Admin dashboard summary (counts, recent activity).",
                "operationId": "d985265804f5fef820a94feb13ef9ef2",
                "responses": {
                    "200": {
                        "description": "Dashboard summary",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "object",
                                                    "additionalProperties": true
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/evaluation-categories": {
            "get": {
                "tags": [
                    "Evaluation Categories"
                ],
                "summary": "List evaluation categories (paginated).",
                "operationId": "8c25004a6f35e040ad9cccea3ec8600a",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "$ref": "#/components/parameters/Search"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated evaluation categories",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/EvaluationCategory"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Evaluation Categories"
                ],
                "summary": "Create an evaluation category.",
                "operationId": "694d22077653d846a46c4929878439d9",
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "name"
                                ],
                                "properties": {
                                    "name": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Created",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/EvaluationCategory"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/evaluation-categories/all": {
            "get": {
                "tags": [
                    "Evaluation Categories"
                ],
                "summary": "List ALL evaluation categories (no pagination). For select dropdowns.",
                "operationId": "f0cb18706c3ca9a7ac33ec1b834ee27d",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "All evaluation categories",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/EvaluationCategory"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/evaluation-categories/{evaluationCategory}": {
            "get": {
                "tags": [
                    "Evaluation Categories"
                ],
                "summary": "Show an evaluation category.",
                "operationId": "db2285e719764f8915bf5b7cd214fc44",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "evaluationCategory",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Evaluation category detail",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/EvaluationCategory"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "put": {
                "tags": [
                    "Evaluation Categories"
                ],
                "summary": "Update an evaluation category.",
                "operationId": "57c5719464c0e8f8fb8cccace81f94ce",
                "parameters": [
                    {
                        "name": "evaluationCategory",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "name"
                                ],
                                "properties": {
                                    "name": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/EvaluationCategory"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "delete": {
                "tags": [
                    "Evaluation Categories"
                ],
                "summary": "Delete an evaluation category.",
                "operationId": "d2b61a1574ee5f5ee871a4e5c869d11e",
                "parameters": [
                    {
                        "name": "evaluationCategory",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/evaluations": {
            "get": {
                "tags": [
                    "Evaluations"
                ],
                "summary": "List evaluation questions (paginated, optionally filtered by category).",
                "operationId": "8b0eb0a2698a28a28f6bd58bfd7b289f",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "$ref": "#/components/parameters/Search"
                    },
                    {
                        "name": "category_id",
                        "in": "query",
                        "description": "Filter by evaluation category id.",
                        "required": false,
                        "schema": {
                            "type": "integer"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated evaluations",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/Evaluation"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Evaluations"
                ],
                "summary": "Create an evaluation question.",
                "operationId": "da7ca2f699a807ea433aefc105ba525c",
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "evaluation_category_id",
                                    "type",
                                    "title"
                                ],
                                "properties": {
                                    "evaluation_category_id": {
                                        "description": "Existing evaluation category id.",
                                        "type": "integer"
                                    },
                                    "type": {
                                        "type": "string",
                                        "enum": [
                                            "text",
                                            "five",
                                            "ten"
                                        ]
                                    },
                                    "title": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "is_required": {
                                        "type": "boolean",
                                        "nullable": true
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Created",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Evaluation"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/evaluations/{evaluation}": {
            "get": {
                "tags": [
                    "Evaluations"
                ],
                "summary": "Show an evaluation question (with category).",
                "operationId": "9fd2fa3b55de34c5c6da79e614260702",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "evaluation",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Evaluation detail",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Evaluation"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "put": {
                "tags": [
                    "Evaluations"
                ],
                "summary": "Update an evaluation question.",
                "operationId": "e9b7d65704183c401fe278e9ed67ed4d",
                "parameters": [
                    {
                        "name": "evaluation",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "evaluation_category_id",
                                    "type",
                                    "title"
                                ],
                                "properties": {
                                    "evaluation_category_id": {
                                        "type": "integer"
                                    },
                                    "type": {
                                        "type": "string",
                                        "enum": [
                                            "text",
                                            "five",
                                            "ten"
                                        ]
                                    },
                                    "title": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "is_required": {
                                        "type": "boolean",
                                        "nullable": true
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Evaluation"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "delete": {
                "tags": [
                    "Evaluations"
                ],
                "summary": "Delete an evaluation question.",
                "operationId": "b4433b49a0a900c144c96b47908cdf44",
                "parameters": [
                    {
                        "name": "evaluation",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/forms": {
            "get": {
                "tags": [
                    "Forms"
                ],
                "summary": "List forms (paginated, admin only).",
                "operationId": "d49fbccdda7e01a0b47fc24728e904f0",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "$ref": "#/components/parameters/Search"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated forms",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/Form"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Forms"
                ],
                "summary": "Create a form (admin only).",
                "operationId": "f21ee159b6fcc30b9ae5ab3980c4a732",
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "title",
                                    "duration",
                                    "full_mark"
                                ],
                                "properties": {
                                    "title": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "duration": {
                                        "description": "Duration in minutes.",
                                        "type": "integer",
                                        "minimum": 1
                                    },
                                    "full_mark": {
                                        "type": "integer",
                                        "minimum": 1
                                    },
                                    "active": {
                                        "type": "boolean",
                                        "nullable": true
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Created",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Form"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/forms/{form}": {
            "get": {
                "tags": [
                    "Forms"
                ],
                "summary": "Show a form with its questions (admin only).",
                "operationId": "896118012734a2002ef3f9159c2e33c4",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "form",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Form",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Form"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "put": {
                "tags": [
                    "Forms"
                ],
                "summary": "Update a form (admin only).",
                "operationId": "d1fce5582ecbb2d169881c08fc66143e",
                "parameters": [
                    {
                        "name": "form",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "properties": {
                                    "title": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "duration": {
                                        "type": "integer",
                                        "minimum": 1
                                    },
                                    "full_mark": {
                                        "type": "integer",
                                        "minimum": 1
                                    },
                                    "active": {
                                        "type": "boolean",
                                        "nullable": true
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Form"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "delete": {
                "tags": [
                    "Forms"
                ],
                "summary": "Delete a form (admin only).",
                "operationId": "7b82a4192045f2b3a0d13afab1180656",
                "parameters": [
                    {
                        "name": "form",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/forms/{form}/questions": {
            "post": {
                "tags": [
                    "Forms"
                ],
                "summary": "Add a question to a form (admin only).",
                "operationId": "429fe32e6a3219b823b1fea73dc607ef",
                "parameters": [
                    {
                        "name": "form",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "type",
                                    "question"
                                ],
                                "properties": {
                                    "type": {
                                        "type": "string",
                                        "enum": [
                                            "radio",
                                            "yes_no",
                                            "text"
                                        ]
                                    },
                                    "question": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "answers": {
                                        "description": "Required for non-text types. Minimum of two answers.",
                                        "type": "array",
                                        "items": {
                                            "required": [
                                                "answer",
                                                "is_true"
                                            ],
                                            "properties": {
                                                "answer": {
                                                    "$ref": "#/components/schemas/TranslatedString"
                                                },
                                                "is_true": {
                                                    "type": "boolean"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Question created",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/FormQuestion"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/forms/{form}/questions/{question}": {
            "delete": {
                "tags": [
                    "Forms"
                ],
                "summary": "Delete a form question (admin only).",
                "operationId": "bf60fd0e3e381a6c05897d9fdd0fa89c",
                "parameters": [
                    {
                        "name": "form",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "question",
                        "in": "path",
                        "description": "Question identifier.",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/instructors": {
            "get": {
                "tags": [
                    "Instructors"
                ],
                "summary": "List instructors (paginated, admin only).",
                "operationId": "de04787951d589e7a0a65ef61743c3a3",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "$ref": "#/components/parameters/Search"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated instructors",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/Instructor"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Instructors"
                ],
                "summary": "Create an instructor (admin only).",
                "operationId": "cd065f5dfe068e363c1084abf0e135cc",
                "requestBody": {
                    "required": true,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "required": [
                                    "name",
                                    "image"
                                ],
                                "properties": {
                                    "name": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "bio": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "image": {
                                        "description": "PNG/JPG/JPEG/WEBP, max 2MB.",
                                        "type": "string",
                                        "format": "binary"
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Created",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Instructor"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/instructors/all": {
            "get": {
                "tags": [
                    "Instructors"
                ],
                "summary": "List ALL instructors (no pagination). Public — for course creation dropdowns.",
                "operationId": "7139febf2bcc6eeb166e9bb258eccf7b",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "All instructors",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/Instructor"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        },
        "/instructors/{instructor}": {
            "get": {
                "tags": [
                    "Instructors"
                ],
                "summary": "Show an instructor (with courses_count).",
                "operationId": "cffd91539f4af6a992959d2130dd1659",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "instructor",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Instructor",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Instructor"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "put": {
                "tags": [
                    "Instructors"
                ],
                "summary": "Update an instructor (admin only).",
                "operationId": "db5a545bc9b2710a0b7a40b79aff2142",
                "parameters": [
                    {
                        "name": "instructor",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "properties": {
                                    "name": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "bio": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "image": {
                                        "description": "PNG/JPG/JPEG/WEBP, max 2MB.",
                                        "type": "string",
                                        "format": "binary",
                                        "nullable": true
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Instructor"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "delete": {
                "tags": [
                    "Instructors"
                ],
                "summary": "Delete an instructor (admin only).",
                "operationId": "4830454df3ac458bf36d3df850f5a9ec",
                "parameters": [
                    {
                        "name": "instructor",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/lectures/{lecture}/progress": {
            "post": {
                "tags": [
                    "Lecture Progress"
                ],
                "summary": "Report the authenticated user's watch progress for a lecture. Auto-marks as completed at 90%+.",
                "operationId": "c858c0ff5ffb4b7b1ce4f49e1ed39dc5",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course identifier",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "lecture",
                        "in": "path",
                        "description": "Lecture identifier",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "progress"
                                ],
                                "properties": {
                                    "progress": {
                                        "description": "Watch percentage 0-100.",
                                        "type": "integer",
                                        "example": 85,
                                        "maximum": 100,
                                        "minimum": 0
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Progress updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "properties": {
                                                        "lecture_id": {
                                                            "type": "integer"
                                                        },
                                                        "progress": {
                                                            "type": "integer",
                                                            "example": 85
                                                        },
                                                        "completed": {
                                                            "type": "boolean"
                                                        }
                                                    },
                                                    "type": "object"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/my-progress": {
            "get": {
                "tags": [
                    "Lecture Progress"
                ],
                "summary": "Get the authenticated user's overall course completion % and per-lecture breakdown.",
                "operationId": "4ccfc3e7b3ef8214c934fbd02276f217",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course identifier",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Course progress detail",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "properties": {
                                                        "course_id": {
                                                            "type": "integer"
                                                        },
                                                        "overall_progress": {
                                                            "description": "Percentage 0-100.",
                                                            "type": "integer",
                                                            "example": 75
                                                        },
                                                        "lectures": {
                                                            "type": "array",
                                                            "items": {
                                                                "$ref": "#/components/schemas/LectureProgress"
                                                            }
                                                        }
                                                    },
                                                    "type": "object"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/notifications": {
            "get": {
                "tags": [
                    "Notifications"
                ],
                "summary": "List notifications (paginated, admin only).",
                "operationId": "3ba22c9d836343d4e5adadc8f93d49df",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated notifications",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/Notification"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Notifications"
                ],
                "summary": "Create and dispatch a notification (admin only).",
                "operationId": "cc06785ef4f3aaa8a06179c35990d936",
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "title",
                                    "body"
                                ],
                                "properties": {
                                    "title": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "body": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "for_public": {
                                        "description": "When true, send to all users.",
                                        "type": "boolean",
                                        "nullable": true
                                    },
                                    "user_codes": {
                                        "description": "Target specific users by employee code. Ignored when for_public=true.",
                                        "type": "array",
                                        "items": {
                                            "type": "string"
                                        },
                                        "nullable": true
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Created",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Notification"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/notifications/{notification}": {
            "get": {
                "tags": [
                    "Notifications"
                ],
                "summary": "Show a notification (admin only).",
                "operationId": "28fdcd49a3e027c51fec7280cff9dc8d",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "notification",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Notification",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Notification"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "put": {
                "tags": [
                    "Notifications"
                ],
                "summary": "Update a notification (admin only).",
                "operationId": "ec9619b2dcdc5efcb606733173555503",
                "parameters": [
                    {
                        "name": "notification",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "properties": {
                                    "title": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "body": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    },
                                    "for_public": {
                                        "type": "boolean",
                                        "nullable": true
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Notification"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "delete": {
                "tags": [
                    "Notifications"
                ],
                "summary": "Delete a notification (admin only).",
                "operationId": "e79365d301472bb9faea96ad1c82ad55",
                "parameters": [
                    {
                        "name": "notification",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/online-users": {
            "get": {
                "tags": [
                    "Online Enrollment"
                ],
                "summary": "Admin: paginated list of users enrolled in an online course.",
                "operationId": "f206a0cab6a7506b682dd2120d884262",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "$ref": "#/components/parameters/Search"
                    },
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course identifier",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated online enrollments",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/OnlineEnrollment"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "put": {
                "tags": [
                    "Online Enrollment"
                ],
                "summary": "Admin: sync users for an online course (replaces the current enrollment list). Supports toggling for_public.",
                "operationId": "a860d44db8c33ff2626ddb6edc02d0e4",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course identifier",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "properties": {
                                    "for_public": {
                                        "description": "When true, marks the online course as open to the public.",
                                        "type": "boolean"
                                    },
                                    "user_ids": {
                                        "type": "array",
                                        "items": {
                                            "type": "integer",
                                            "example": 42
                                        }
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Enrollment list synced",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Online Enrollment"
                ],
                "summary": "Admin: attach users to an online course (additive; does not remove existing enrollments).",
                "operationId": "2a03475624c2ecc47c89e603af354622",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course identifier",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "user_ids"
                                ],
                                "properties": {
                                    "user_ids": {
                                        "type": "array",
                                        "items": {
                                            "type": "integer",
                                            "example": 42
                                        },
                                        "minItems": 1
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Users attached",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "delete": {
                "tags": [
                    "Online Enrollment"
                ],
                "summary": "Admin: remove a single user from an online course.",
                "operationId": "d06a8c38d3f3301fbd58c57a0e0adf7e",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course identifier",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "user_id"
                                ],
                                "properties": {
                                    "user_id": {
                                        "type": "integer",
                                        "example": 42
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "User detached",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/qualification-skills": {
            "get": {
                "tags": [
                    "Qualification Skills"
                ],
                "summary": "List qualification skills (paginated).",
                "operationId": "aa07be1fd1e7e3fe04f781493bb6a51a",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "$ref": "#/components/parameters/Search"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated qualification skills",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/QualificationSkill"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Qualification Skills"
                ],
                "summary": "Create a qualification skill (admin only).",
                "operationId": "eb3ef50ea20d9cc152241956bb1d74d3",
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "name"
                                ],
                                "properties": {
                                    "name": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Created",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/QualificationSkill"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/qualification-skills/active": {
            "get": {
                "tags": [
                    "Qualification Skills"
                ],
                "summary": "List ALL qualification skills (no pagination). For select dropdowns.",
                "operationId": "bcf47a2203ceccb179220bc62f6115b6",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "All qualification skills",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/QualificationSkill"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        },
        "/qualification-skills/{qualification_skill}": {
            "get": {
                "tags": [
                    "Qualification Skills"
                ],
                "summary": "Show a qualification skill (with courses_count).",
                "operationId": "26fd84400299f285a5d5c4fa8701b680",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "qualification_skill",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Qualification skill",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/QualificationSkill"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "put": {
                "tags": [
                    "Qualification Skills"
                ],
                "summary": "Update a qualification skill (admin only).",
                "operationId": "7682ac44d67127bc91b46d0bb4a2cd38",
                "parameters": [
                    {
                        "name": "qualification_skill",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "properties": {
                                    "name": {
                                        "$ref": "#/components/schemas/TranslatedString"
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/QualificationSkill"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "delete": {
                "tags": [
                    "Qualification Skills"
                ],
                "summary": "Delete a qualification skill (admin only).",
                "operationId": "3029e3d42e360eb068513acf423e56fb",
                "parameters": [
                    {
                        "name": "qualification_skill",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/roles": {
            "get": {
                "tags": [
                    "Roles"
                ],
                "summary": "List roles (paginated).",
                "operationId": "ba6319145278e4599032360cfa42cfb5",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "$ref": "#/components/parameters/Search"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated roles",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/Role"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Roles"
                ],
                "summary": "Create a role with permissions.",
                "operationId": "0ee1d638baa49618133b7df64a50abdf",
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "name"
                                ],
                                "properties": {
                                    "name": {
                                        "type": "string",
                                        "maxLength": 255
                                    },
                                    "permissions": {
                                        "type": "array",
                                        "items": {
                                            "description": "Existing permission name.",
                                            "type": "string"
                                        },
                                        "nullable": true
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Created",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Role"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/roles/all": {
            "get": {
                "tags": [
                    "Roles"
                ],
                "summary": "List ALL roles (no pagination). For select dropdowns.",
                "operationId": "616ce7a993c6026318d20c7118f56c46",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "All roles",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/Role"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/roles/{role}": {
            "get": {
                "tags": [
                    "Roles"
                ],
                "summary": "Show a role (with permissions).",
                "operationId": "b235c7d2f4abfcbb47849cb9fd68a60c",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "role",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Role detail",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Role"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "put": {
                "tags": [
                    "Roles"
                ],
                "summary": "Update a role and its permissions.",
                "operationId": "aa96275fef66ffd30fb5cf82f82b8967",
                "parameters": [
                    {
                        "name": "role",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "name"
                                ],
                                "properties": {
                                    "name": {
                                        "type": "string",
                                        "maxLength": 255
                                    },
                                    "permissions": {
                                        "type": "array",
                                        "items": {
                                            "description": "Existing permission name.",
                                            "type": "string"
                                        },
                                        "nullable": true
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/Role"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "delete": {
                "tags": [
                    "Roles"
                ],
                "summary": "Delete a role.",
                "operationId": "2c89ac4fd6245963376daed3daa56c0c",
                "parameters": [
                    {
                        "name": "role",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/settings": {
            "get": {
                "tags": [
                    "Settings"
                ],
                "summary": "Get public settings as a key=>value map. Public.",
                "operationId": "721019f58806159bc020228ca81a1230",
                "responses": {
                    "200": {
                        "description": "Settings map",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "object",
                                                    "example": {
                                                        "site_name": "2B Academy",
                                                        "support_email": "info@example.com"
                                                    },
                                                    "additionalProperties": {
                                                        "type": "string"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        },
        "/admin/settings": {
            "get": {
                "tags": [
                    "Settings"
                ],
                "summary": "Get the full settings list with type metadata (admin only).",
                "operationId": "fc142d9ffcb6eaf2bd30351c4336b1a6",
                "responses": {
                    "200": {
                        "description": "Full settings list",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "properties": {
                                                            "id": {
                                                                "type": "integer"
                                                            },
                                                            "key": {
                                                                "type": "string"
                                                            },
                                                            "value": {
                                                                "type": "string",
                                                                "nullable": true
                                                            },
                                                            "type": {
                                                                "type": "string"
                                                            },
                                                            "label": {
                                                                "type": "string"
                                                            }
                                                        },
                                                        "type": "object"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "put": {
                "tags": [
                    "Settings"
                ],
                "summary": "Update one or many settings (admin only).",
                "operationId": "02b370e3bb615ac8c21caedb4d6db579",
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "settings"
                                ],
                                "properties": {
                                    "settings": {
                                        "description": "Map of setting key to string value.",
                                        "type": "object",
                                        "example": {
                                            "site_name": "2B Academy",
                                            "support_email": "info@example.com"
                                        },
                                        "additionalProperties": {
                                            "type": "string",
                                            "nullable": true
                                        }
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated settings map",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "object",
                                                    "additionalProperties": {
                                                        "type": "string"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/users": {
            "get": {
                "tags": [
                    "Users"
                ],
                "summary": "List users (paginated).",
                "operationId": "90e0af02f8d17320841c857da68aaedd",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "$ref": "#/components/parameters/Search"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated users",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/User"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Users"
                ],
                "summary": "Create a user (admin only).",
                "operationId": "11e86bd738020c1c4797a21a263ca347",
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "name"
                                ],
                                "properties": {
                                    "name": {
                                        "type": "string",
                                        "maxLength": 255
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Created",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/User"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/users/{user}": {
            "get": {
                "tags": [
                    "Users"
                ],
                "summary": "Show a user (with activity).",
                "operationId": "c9cfbd9beb222ed670bd79cceb7acf91",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "user",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "User detail",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/User"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "put": {
                "tags": [
                    "Users"
                ],
                "summary": "Update a user (admin only).",
                "operationId": "0cd36870eb412877348664489e7bf294",
                "parameters": [
                    {
                        "name": "user",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "content": {
                        "application/json": {
                            "schema": {
                                "properties": {
                                    "name": {
                                        "type": "string",
                                        "maxLength": 255
                                    },
                                    "phone": {
                                        "type": "string",
                                        "nullable": true,
                                        "maxLength": 50
                                    },
                                    "department_name": {
                                        "type": "string",
                                        "nullable": true,
                                        "maxLength": 255
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Updated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/User"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "delete": {
                "tags": [
                    "Users"
                ],
                "summary": "Delete a user (admin only).",
                "operationId": "9b2f9d4283680b6c8b38cf6a1c2a9b75",
                "parameters": [
                    {
                        "name": "user",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Deleted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/users/search": {
            "get": {
                "tags": [
                    "Users"
                ],
                "summary": "Lightweight user list for select2 / dropdowns.",
                "operationId": "2ed4c60cbe2a0588187e5a0b3cb0865d",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "q",
                        "in": "query",
                        "description": "Search term for filtering users by name/email.",
                        "required": false,
                        "schema": {
                            "type": "string"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Users matching the query",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/User"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/evaluate": {
            "get": {
                "tags": [
                    "Course Evaluations"
                ],
                "summary": "Get the course evaluation form (categories + questions) and whether the current user has already submitted it.",
                "operationId": "eef20288d768783e275326334b628a73",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "course",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Course evaluation form",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "properties": {
                                                        "already_evaluated": {
                                                            "type": "boolean"
                                                        },
                                                        "evaluation_categories": {
                                                            "type": "array",
                                                            "items": {
                                                                "$ref": "#/components/schemas/EvaluationCategory"
                                                            }
                                                        }
                                                    },
                                                    "type": "object"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "Course Evaluations"
                ],
                "summary": "Submit a course evaluation (once per user/course).",
                "operationId": "e2c6a409e678ad5fb0b70c254fccd258",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "instructor_id",
                                    "questions"
                                ],
                                "properties": {
                                    "instructor_id": {
                                        "description": "Existing instructor id.",
                                        "type": "integer"
                                    },
                                    "questions": {
                                        "description": "Map of evaluation_question_id => answer (string for text, integer for stars/ratings).",
                                        "type": "object",
                                        "example": {
                                            "1": 5,
                                            "2": "Great course!"
                                        }
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Submitted",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "409": {
                        "description": "Already evaluated",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/ErrorResponse"
                                }
                            }
                        }
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/progress": {
            "get": {
                "tags": [
                    "Progress"
                ],
                "summary": "Admin: paginated overview of user course progress, with optional filters.",
                "operationId": "853826ea189e87cb07e7d323a9eec251",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "name": "course_id",
                        "in": "query",
                        "description": "Filter by course id.",
                        "required": false,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "group_id",
                        "in": "query",
                        "description": "Filter by course section (group) id.",
                        "required": false,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "user_id",
                        "in": "query",
                        "description": "Filter by user id.",
                        "required": false,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated user course progress rows",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "properties": {
                                                            "user_id": {
                                                                "type": "integer"
                                                            },
                                                            "user_name": {
                                                                "type": "string"
                                                            },
                                                            "course_id": {
                                                                "type": "integer"
                                                            },
                                                            "course_title": {
                                                                "description": "Localized course title.",
                                                                "type": "string"
                                                            },
                                                            "overall_progress": {
                                                                "type": "integer",
                                                                "example": 75
                                                            }
                                                        },
                                                        "type": "object"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/my/dashboard": {
            "get": {
                "tags": [
                    "My"
                ],
                "summary": "Get the authenticated user's personal stats summary.",
                "operationId": "23c52693d12567d37a39e3448f8f4560",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Personal dashboard stats",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "properties": {
                                                        "enrolled_courses": {
                                                            "type": "integer",
                                                            "example": 5
                                                        },
                                                        "completed_courses": {
                                                            "type": "integer",
                                                            "example": 2
                                                        },
                                                        "certificates": {
                                                            "type": "integer",
                                                            "example": 2
                                                        },
                                                        "exams_taken": {
                                                            "type": "integer",
                                                            "example": 8
                                                        },
                                                        "exams_passed": {
                                                            "type": "integer",
                                                            "example": 6
                                                        }
                                                    },
                                                    "type": "object"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/my/courses": {
            "get": {
                "tags": [
                    "My"
                ],
                "summary": "List the authenticated user's enrolled + public courses.",
                "operationId": "e92fc073635765c053a7cd960112436b",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Courses available to the user",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/Course"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/my/exams": {
            "get": {
                "tags": [
                    "My"
                ],
                "summary": "List the authenticated user's own exam history.",
                "operationId": "e04d413ae28e7ec198c1882edda45fb5",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "User exam history",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/UserExam"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/my/exams/{id}": {
            "get": {
                "tags": [
                    "My"
                ],
                "summary": "Get one of the authenticated user's exam results with the full answer breakdown.",
                "operationId": "2742c5c7d752a7ab78dbc088c89ee840",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/IdPath"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Exam result with answers",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/UserExam"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/my/assignments": {
            "get": {
                "tags": [
                    "My"
                ],
                "summary": "List assignments across the user's enrolled courses, including submission status.",
                "operationId": "c8b111793033ac8ef61b8ccd4a33f80f",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Assignments with submission status",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/CourseAssignment"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/my/certificates": {
            "get": {
                "tags": [
                    "My"
                ],
                "summary": "List the authenticated user's earned certificates.",
                "operationId": "f9ac71d41bc1ac5271602c6b91d95459",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Earned certificates",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "properties": {
                                                            "type": {
                                                                "type": "string",
                                                                "example": "course"
                                                            },
                                                            "course_id": {
                                                                "type": "integer",
                                                                "nullable": true
                                                            },
                                                            "course": {
                                                                "description": "Localized course title.",
                                                                "type": "string",
                                                                "nullable": true
                                                            },
                                                            "earned_at": {
                                                                "type": "string",
                                                                "format": "date",
                                                                "nullable": true
                                                            }
                                                        },
                                                        "type": "object"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/my/ratings": {
            "get": {
                "tags": [
                    "My"
                ],
                "summary": "List the authenticated user's own course ratings.",
                "operationId": "0b81e065cf21e30ee7568a8a531b40df",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "User course ratings",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/CourseRating"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/my/lecture-questions": {
            "get": {
                "tags": [
                    "My"
                ],
                "summary": "List the authenticated user's own lecture questions with their answers.",
                "operationId": "046c64c4a7fe978831a359a9d92e7bd5",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    }
                ],
                "responses": {
                    "200": {
                        "description": "User lecture questions",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/LectureQuestion"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/my/progress/{courseId}": {
            "get": {
                "tags": [
                    "My"
                ],
                "summary": "Get course completion percentage with per-lecture progress detail for the authenticated user.",
                "operationId": "8bd240ee7b88d42e7e9ff9363b839e1f",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "courseId",
                        "in": "path",
                        "description": "Course identifier",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Course progress detail",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "properties": {
                                                        "course_id": {
                                                            "type": "integer",
                                                            "example": 12
                                                        },
                                                        "overall_progress": {
                                                            "description": "Percentage 0-100.",
                                                            "type": "integer",
                                                            "example": 75
                                                        },
                                                        "lectures": {
                                                            "type": "array",
                                                            "items": {
                                                                "$ref": "#/components/schemas/LectureProgress"
                                                            }
                                                        }
                                                    },
                                                    "type": "object"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/enrollments": {
            "get": {
                "tags": [
                    "User Enrollment"
                ],
                "summary": "Admin: paginated list of offline enrollments for a course (optionally filtered by group).",
                "operationId": "0b271fcf03163e53c0a3e6d0f098fc7c",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "$ref": "#/components/parameters/Page"
                    },
                    {
                        "$ref": "#/components/parameters/PerPage"
                    },
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course identifier",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "group_id",
                        "in": "query",
                        "description": "Filter enrollments by course section (group) id.",
                        "required": false,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Paginated offline enrollments",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "type": "array",
                                                    "items": {
                                                        "$ref": "#/components/schemas/OfflineEnrollment"
                                                    }
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            },
            "post": {
                "tags": [
                    "User Enrollment"
                ],
                "summary": "Admin: enroll one or more users into an offline course section (group).",
                "operationId": "b4161317cc41edc781df1186e6d9266d",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course identifier",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "group_id",
                                    "user_ids"
                                ],
                                "properties": {
                                    "group_id": {
                                        "description": "Course section (group) id.",
                                        "type": "integer",
                                        "example": 3
                                    },
                                    "user_ids": {
                                        "type": "array",
                                        "items": {
                                            "type": "integer",
                                            "example": 42
                                        },
                                        "minItems": 1
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Users enrolled",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "properties": {
                                                        "enrolled": {
                                                            "description": "Number of users actually enrolled.",
                                                            "type": "integer",
                                                            "example": 3
                                                        }
                                                    },
                                                    "type": "object"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/enrollments/{enrollment}": {
            "delete": {
                "tags": [
                    "User Enrollment"
                ],
                "summary": "Admin: remove a single offline enrollment from a course.",
                "operationId": "55e5b65fe6660ca524c704b7d327add4",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course identifier",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "enrollment",
                        "in": "path",
                        "description": "Enrollment (users_courses) identifier",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Enrollment removed",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/EmptyResponse"
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "403": {
                        "$ref": "#/components/responses/Forbidden"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/courses/{course}/exams/{exam}/submit": {
            "post": {
                "tags": [
                    "Exams"
                ],
                "summary": "Submit exam answers for the authenticated user — auto-graded, returns the result.",
                "operationId": "2f373113396e5eb40c0cb35c1cf14aac",
                "parameters": [
                    {
                        "name": "course",
                        "in": "path",
                        "description": "Course identifier",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    },
                    {
                        "name": "exam",
                        "in": "path",
                        "description": "Exam identifier",
                        "required": true,
                        "schema": {
                            "type": "integer",
                            "minimum": 1
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "questions"
                                ],
                                "properties": {
                                    "questions": {
                                        "type": "array",
                                        "items": {
                                            "required": [
                                                "question_id",
                                                "question_title",
                                                "answer_id"
                                            ],
                                            "properties": {
                                                "question_id": {
                                                    "type": "integer",
                                                    "example": 42
                                                },
                                                "question_title": {
                                                    "type": "string",
                                                    "example": "What is 2 + 2?"
                                                },
                                                "answer_id": {
                                                    "type": "integer",
                                                    "example": 7
                                                }
                                            },
                                            "type": "object"
                                        },
                                        "minItems": 1
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "201": {
                        "description": "Exam submitted and graded",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "$ref": "#/components/schemas/UserExam"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "409": {
                        "description": "Exam already submitted by this user",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/ErrorResponse"
                                }
                            }
                        }
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/forms/{formUuid}/start": {
            "get": {
                "tags": [
                    "User Forms"
                ],
                "summary": "Start (or resume) a form session for the authenticated user.",
                "operationId": "94b71dc7673c6441fe244af56d00f421",
                "parameters": [
                    {
                        "$ref": "#/components/parameters/AcceptLanguage"
                    },
                    {
                        "name": "formUuid",
                        "in": "path",
                        "description": "Form UUID",
                        "required": true,
                        "schema": {
                            "type": "string",
                            "format": "uuid"
                        }
                    }
                ],
                "responses": {
                    "200": {
                        "description": "Form with questions and session timing",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "properties": {
                                                        "form": {
                                                            "$ref": "#/components/schemas/Form"
                                                        },
                                                        "session": {
                                                            "properties": {
                                                                "start_at": {
                                                                    "type": "string",
                                                                    "format": "date-time",
                                                                    "nullable": true
                                                                },
                                                                "end_at": {
                                                                    "type": "string",
                                                                    "format": "date-time",
                                                                    "nullable": true
                                                                },
                                                                "submitted": {
                                                                    "type": "boolean"
                                                                }
                                                            },
                                                            "type": "object"
                                                        }
                                                    },
                                                    "type": "object"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        },
        "/forms/{formUuid}/submit": {
            "post": {
                "tags": [
                    "User Forms"
                ],
                "summary": "Submit form answers for the authenticated user. Auto-grades MCQ; stores text answers as correct.",
                "operationId": "11f188271dfd78f1ebbd9f34e28bef47",
                "parameters": [
                    {
                        "name": "formUuid",
                        "in": "path",
                        "description": "Form UUID",
                        "required": true,
                        "schema": {
                            "type": "string",
                            "format": "uuid"
                        }
                    }
                ],
                "requestBody": {
                    "required": true,
                    "content": {
                        "application/json": {
                            "schema": {
                                "required": [
                                    "questions"
                                ],
                                "properties": {
                                    "questions": {
                                        "type": "array",
                                        "items": {
                                            "required": [
                                                "question_id",
                                                "question_title",
                                                "answer_id"
                                            ],
                                            "properties": {
                                                "question_id": {
                                                    "type": "integer",
                                                    "example": 12
                                                },
                                                "question_title": {
                                                    "type": "string",
                                                    "example": "What is your name?"
                                                },
                                                "answer_id": {
                                                    "description": "Selected answer id (integer for MCQ) or free-text answer (string).",
                                                    "example": 4
                                                }
                                            },
                                            "type": "object"
                                        },
                                        "minItems": 1
                                    },
                                    "minutes_remaining": {
                                        "type": "integer",
                                        "example": 5,
                                        "minimum": 0
                                    }
                                },
                                "type": "object"
                            }
                        }
                    }
                },
                "responses": {
                    "200": {
                        "description": "Form submitted and graded",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "allOf": [
                                        {
                                            "$ref": "#/components/schemas/SuccessResponse"
                                        },
                                        {
                                            "properties": {
                                                "result": {
                                                    "properties": {
                                                        "mark": {
                                                            "type": "integer",
                                                            "example": 8
                                                        },
                                                        "duration": {
                                                            "description": "Total minutes spent on the form.",
                                                            "type": "integer",
                                                            "example": 25
                                                        }
                                                    },
                                                    "type": "object"
                                                }
                                            },
                                            "type": "object"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "401": {
                        "$ref": "#/components/responses/Unauthorized"
                    },
                    "404": {
                        "$ref": "#/components/responses/NotFound"
                    },
                    "409": {
                        "description": "Form already submitted by this user",
                        "content": {
                            "application/json": {
                                "schema": {
                                    "$ref": "#/components/schemas/ErrorResponse"
                                }
                            }
                        }
                    },
                    "422": {
                        "$ref": "#/components/responses/ValidationError"
                    }
                },
                "security": [
                    {
                        "BearerAuth": []
                    }
                ]
            }
        }
    },
    "components": {
        "schemas": {
            "About": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "title": {
                        "description": "Localized title.",
                        "type": "string"
                    },
                    "description": {
                        "description": "Localized description.",
                        "type": "string"
                    },
                    "vision": {
                        "description": "Localized vision.",
                        "type": "string",
                        "nullable": true
                    },
                    "mission": {
                        "description": "Localized mission.",
                        "type": "string",
                        "nullable": true
                    }
                },
                "type": "object"
            },
            "Admin": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "name": {
                        "type": "string"
                    },
                    "email": {
                        "type": "string",
                        "format": "email"
                    },
                    "roles": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        }
                    },
                    "created_at": {
                        "type": "string",
                        "format": "date"
                    }
                },
                "type": "object"
            },
            "Article": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "title": {
                        "description": "Localized title.",
                        "type": "string"
                    },
                    "description": {
                        "description": "Localized description.",
                        "type": "string"
                    },
                    "image": {
                        "type": "string",
                        "format": "uri",
                        "nullable": true
                    },
                    "created_at": {
                        "type": "string",
                        "format": "date"
                    }
                },
                "type": "object"
            },
            "Attendance": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "user_id": {
                        "type": "integer"
                    },
                    "course_id": {
                        "type": "integer"
                    },
                    "session_id": {
                        "type": "integer",
                        "nullable": true
                    },
                    "attended_at": {
                        "type": "string",
                        "format": "date-time"
                    }
                },
                "type": "object"
            },
            "Category": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "name": {
                        "description": "Localized name.",
                        "type": "string"
                    },
                    "logo": {
                        "type": "string",
                        "format": "uri",
                        "nullable": true
                    },
                    "active": {
                        "type": "boolean"
                    },
                    "courses_count": {
                        "type": "integer"
                    },
                    "created_at": {
                        "type": "string",
                        "format": "date"
                    }
                },
                "type": "object"
            },
            "Certificate": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "user_id": {
                        "type": "integer"
                    },
                    "course_id": {
                        "type": "integer"
                    },
                    "course_title": {
                        "type": "string"
                    },
                    "issued_at": {
                        "type": "string",
                        "format": "date"
                    },
                    "download_url": {
                        "type": "string",
                        "format": "uri",
                        "nullable": true
                    }
                },
                "type": "object"
            },
            "Course": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "title": {
                        "description": "Localized course title.",
                        "type": "string"
                    },
                    "description": {
                        "description": "Localized course description.",
                        "type": "string"
                    },
                    "course_type": {
                        "type": "string",
                        "enum": [
                            "online",
                            "offline"
                        ]
                    },
                    "category": {
                        "properties": {
                            "id": {
                                "type": "integer"
                            },
                            "name": {
                                "type": "string"
                            }
                        },
                        "type": "object"
                    },
                    "instructors": {
                        "type": "array",
                        "items": {
                            "properties": {
                                "id": {
                                    "type": "integer"
                                },
                                "name": {
                                    "type": "string"
                                }
                            },
                            "type": "object"
                        }
                    },
                    "qualification_skills": {
                        "type": "array",
                        "items": {
                            "properties": {
                                "id": {
                                    "type": "integer"
                                },
                                "name": {
                                    "type": "string"
                                }
                            },
                            "type": "object"
                        }
                    },
                    "image": {
                        "type": "string",
                        "format": "uri",
                        "nullable": true
                    },
                    "intro_video": {
                        "type": "string",
                        "nullable": true
                    },
                    "hours": {
                        "type": "integer"
                    },
                    "language": {
                        "type": "string",
                        "nullable": true
                    },
                    "level": {
                        "type": "string",
                        "nullable": true
                    },
                    "price": {
                        "type": "number",
                        "format": "float",
                        "nullable": true
                    },
                    "currency": {
                        "type": "string",
                        "nullable": true
                    },
                    "certificate": {
                        "type": "boolean"
                    },
                    "active": {
                        "type": "boolean"
                    },
                    "for_public": {
                        "type": "boolean"
                    },
                    "is_evaluate": {
                        "type": "boolean"
                    },
                    "outside_materials": {
                        "type": "boolean"
                    },
                    "allow_attendances": {
                        "type": "boolean"
                    },
                    "created_at": {
                        "type": "string",
                        "format": "date"
                    }
                },
                "type": "object"
            },
            "CourseAssignment": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "course_id": {
                        "type": "integer"
                    },
                    "title": {
                        "description": "Localized title.",
                        "type": "string"
                    },
                    "description": {
                        "description": "Localized description.",
                        "type": "string"
                    },
                    "due_date": {
                        "type": "string",
                        "format": "date-time",
                        "nullable": true
                    }
                },
                "type": "object"
            },
            "CourseAssignmentSubmission": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "assignment_id": {
                        "type": "integer"
                    },
                    "user_id": {
                        "type": "integer"
                    },
                    "content": {
                        "type": "string",
                        "nullable": true
                    },
                    "file": {
                        "type": "string",
                        "format": "uri",
                        "nullable": true
                    },
                    "score": {
                        "type": "integer",
                        "nullable": true
                    },
                    "feedback": {
                        "type": "string",
                        "nullable": true
                    },
                    "submitted_at": {
                        "type": "string",
                        "format": "date-time"
                    }
                },
                "type": "object"
            },
            "CourseDetail": {
                "allOf": [
                    {
                        "$ref": "#/components/schemas/Course"
                    },
                    {
                        "properties": {
                            "title_for_certificate": {
                                "type": "string",
                                "nullable": true
                            },
                            "sections": {
                                "type": "array",
                                "items": {
                                    "$ref": "#/components/schemas/CourseSection"
                                }
                            },
                            "exams": {
                                "type": "array",
                                "items": {
                                    "properties": {
                                        "id": {
                                            "type": "integer"
                                        },
                                        "title": {
                                            "type": "string"
                                        },
                                        "degree": {
                                            "type": "integer"
                                        },
                                        "is_final": {
                                            "type": "boolean"
                                        }
                                    },
                                    "type": "object"
                                }
                            }
                        },
                        "type": "object"
                    }
                ]
            },
            "CourseExam": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "course_id": {
                        "type": "integer"
                    },
                    "title": {
                        "description": "Localized title.",
                        "type": "string"
                    },
                    "degree": {
                        "description": "Total points.",
                        "type": "integer"
                    },
                    "is_final": {
                        "type": "boolean"
                    },
                    "questions": {
                        "type": "array",
                        "items": {
                            "$ref": "#/components/schemas/CourseExamQuestion"
                        }
                    }
                },
                "type": "object"
            },
            "CourseExamQuestion": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "exam_id": {
                        "type": "integer"
                    },
                    "question": {
                        "description": "Localized question text.",
                        "type": "string"
                    },
                    "answers": {
                        "type": "array",
                        "items": {
                            "properties": {
                                "id": {
                                    "type": "integer"
                                },
                                "answer": {
                                    "type": "string"
                                },
                                "is_correct": {
                                    "type": "boolean"
                                }
                            },
                            "type": "object"
                        }
                    }
                },
                "type": "object"
            },
            "CourseLecture": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "section_id": {
                        "type": "integer"
                    },
                    "title": {
                        "description": "Localized title.",
                        "type": "string"
                    },
                    "type": {
                        "type": "string",
                        "enum": [
                            "url",
                            "file",
                            "video"
                        ]
                    },
                    "video_url": {
                        "type": "string",
                        "nullable": true
                    },
                    "order": {
                        "type": "integer",
                        "nullable": true
                    }
                },
                "type": "object"
            },
            "CourseRating": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "course_id": {
                        "type": "integer"
                    },
                    "user_id": {
                        "type": "integer"
                    },
                    "stars": {
                        "type": "integer",
                        "maximum": 5,
                        "minimum": 1
                    },
                    "comment": {
                        "type": "string",
                        "nullable": true
                    },
                    "created_at": {
                        "type": "string",
                        "format": "date-time"
                    }
                },
                "type": "object"
            },
            "CourseSection": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "course_id": {
                        "type": "integer"
                    },
                    "name": {
                        "description": "Localized name.",
                        "type": "string"
                    },
                    "order": {
                        "type": "integer",
                        "nullable": true
                    }
                },
                "type": "object"
            },
            "CourseSession": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "course_id": {
                        "type": "integer"
                    },
                    "title": {
                        "description": "Localized session title.",
                        "type": "string"
                    },
                    "start_date": {
                        "type": "string",
                        "format": "date-time"
                    },
                    "end_date": {
                        "type": "string",
                        "format": "date-time",
                        "nullable": true
                    },
                    "location": {
                        "type": "string",
                        "nullable": true
                    }
                },
                "type": "object"
            },
            "TranslatedString": {
                "description": "Bilingual string used for translatable INPUT bodies. Response bodies return a single localized string based on the request locale.",
                "required": [
                    "ar",
                    "en"
                ],
                "properties": {
                    "ar": {
                        "description": "Reusable response envelopes, primitives, parameters, and responses\nshared by every endpoint in the API.\n\n--------------------------------------------------------------------\nSchemas\n--------------------------------------------------------------------",
                        "type": "string",
                        "example": "نص عربي"
                    },
                    "en": {
                        "type": "string",
                        "example": "English text"
                    }
                },
                "type": "object"
            },
            "SuccessResponse": {
                "properties": {
                    "status": {
                        "type": "string",
                        "example": "success"
                    },
                    "message": {
                        "type": "string",
                        "example": "Data retrieved successfully."
                    },
                    "result": {}
                },
                "type": "object"
            },
            "EmptyResponse": {
                "properties": {
                    "status": {
                        "type": "string",
                        "example": "success"
                    },
                    "message": {
                        "type": "string",
                        "example": "Operation completed successfully."
                    },
                    "result": {
                        "type": "object",
                        "example": null,
                        "nullable": true
                    }
                },
                "type": "object"
            },
            "ErrorResponse": {
                "properties": {
                    "status": {
                        "type": "string",
                        "example": "error"
                    },
                    "message": {
                        "type": "string",
                        "example": "Something went wrong."
                    }
                },
                "type": "object"
            },
            "ValidationErrorResponse": {
                "properties": {
                    "status": {
                        "type": "string",
                        "example": "error"
                    },
                    "message": {
                        "type": "string",
                        "example": "The given data was invalid."
                    },
                    "errors": {
                        "type": "object",
                        "example": {
                            "name": [
                                "The name field is required."
                            ]
                        },
                        "additionalProperties": {
                            "type": "array",
                            "items": {
                                "type": "string"
                            }
                        }
                    }
                },
                "type": "object"
            },
            "PaginationMeta": {
                "properties": {
                    "current_page": {
                        "type": "integer",
                        "example": 1
                    },
                    "from": {
                        "type": "integer",
                        "example": 1,
                        "nullable": true
                    },
                    "last_page": {
                        "type": "integer",
                        "example": 10
                    },
                    "per_page": {
                        "type": "integer",
                        "example": 15
                    },
                    "to": {
                        "type": "integer",
                        "example": 15,
                        "nullable": true
                    },
                    "total": {
                        "type": "integer",
                        "example": 148
                    }
                },
                "type": "object"
            },
            "PaginationLinks": {
                "properties": {
                    "first": {
                        "type": "string",
                        "example": "https://example.com/api/v1/items?page=1",
                        "nullable": true
                    },
                    "last": {
                        "type": "string",
                        "example": "https://example.com/api/v1/items?page=10",
                        "nullable": true
                    },
                    "prev": {
                        "type": "string",
                        "example": null,
                        "nullable": true
                    },
                    "next": {
                        "type": "string",
                        "example": "https://example.com/api/v1/items?page=2",
                        "nullable": true
                    }
                },
                "type": "object"
            },
            "Evaluation": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "category_id": {
                        "type": "integer"
                    },
                    "question": {
                        "description": "Localized question text.",
                        "type": "string"
                    },
                    "type": {
                        "type": "string",
                        "enum": [
                            "stars",
                            "text",
                            "yes_no"
                        ]
                    }
                },
                "type": "object"
            },
            "EvaluationCategory": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "title": {
                        "description": "Localized title.",
                        "type": "string"
                    },
                    "description": {
                        "description": "Localized description.",
                        "type": "string",
                        "nullable": true
                    }
                },
                "type": "object"
            },
            "Form": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "uuid": {
                        "type": "string",
                        "format": "uuid"
                    },
                    "title": {
                        "description": "Localized form title.",
                        "type": "string"
                    },
                    "description": {
                        "description": "Localized description.",
                        "type": "string",
                        "nullable": true
                    },
                    "active": {
                        "type": "boolean"
                    },
                    "questions": {
                        "type": "array",
                        "items": {
                            "$ref": "#/components/schemas/FormQuestion"
                        }
                    }
                },
                "type": "object"
            },
            "FormQuestion": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "form_id": {
                        "type": "integer"
                    },
                    "question": {
                        "description": "Localized question.",
                        "type": "string"
                    },
                    "type": {
                        "type": "string",
                        "enum": [
                            "text",
                            "radio",
                            "checkbox",
                            "stars",
                            "yes_no"
                        ]
                    },
                    "answers": {
                        "type": "array",
                        "items": {
                            "properties": {
                                "id": {
                                    "type": "integer"
                                },
                                "answer": {
                                    "type": "string"
                                }
                            },
                            "type": "object"
                        }
                    }
                },
                "type": "object"
            },
            "Instructor": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "name": {
                        "description": "Localized name.",
                        "type": "string"
                    },
                    "bio": {
                        "description": "Localized bio.",
                        "type": "string",
                        "nullable": true
                    },
                    "job_title": {
                        "description": "Localized job title.",
                        "type": "string",
                        "nullable": true
                    },
                    "image": {
                        "type": "string",
                        "format": "uri",
                        "nullable": true
                    },
                    "created_at": {
                        "type": "string",
                        "format": "date"
                    }
                },
                "type": "object"
            },
            "LectureProgress": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "lecture_id": {
                        "type": "integer"
                    },
                    "user_id": {
                        "type": "integer"
                    },
                    "watched": {
                        "type": "boolean"
                    },
                    "completed": {
                        "type": "boolean"
                    },
                    "updated_at": {
                        "type": "string",
                        "format": "date-time"
                    }
                },
                "type": "object"
            },
            "LectureQuestion": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "lecture_id": {
                        "type": "integer"
                    },
                    "user_id": {
                        "type": "integer"
                    },
                    "question": {
                        "type": "string"
                    },
                    "answer": {
                        "type": "string",
                        "nullable": true
                    },
                    "created_at": {
                        "type": "string",
                        "format": "date-time"
                    }
                },
                "type": "object"
            },
            "Notification": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "title": {
                        "description": "Localized title.",
                        "type": "string"
                    },
                    "body": {
                        "description": "Localized body.",
                        "type": "string"
                    },
                    "created_at": {
                        "type": "string",
                        "format": "date-time"
                    }
                },
                "type": "object"
            },
            "OfflineEnrollment": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "user_id": {
                        "type": "integer"
                    },
                    "course_id": {
                        "type": "integer"
                    },
                    "group_id": {
                        "type": "integer",
                        "nullable": true
                    },
                    "created_at": {
                        "type": "string",
                        "format": "date-time"
                    }
                },
                "type": "object"
            },
            "OnlineEnrollment": {
                "properties": {
                    "user_id": {
                        "type": "integer"
                    },
                    "course_id": {
                        "type": "integer"
                    },
                    "enrolled_at": {
                        "type": "string",
                        "format": "date-time"
                    }
                },
                "type": "object"
            },
            "QualificationSkill": {
                "properties": {
                    "id": {
                        "type": "integer",
                        "example": 1
                    },
                    "name": {
                        "description": "Localized name (Arabic or English depending on request locale).",
                        "type": "string",
                        "example": "Communication"
                    },
                    "courses_count": {
                        "type": "integer",
                        "example": 3
                    },
                    "created_at": {
                        "type": "string",
                        "format": "date"
                    }
                },
                "type": "object"
            },
            "Role": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "name": {
                        "type": "string"
                    },
                    "guard_name": {
                        "type": "string"
                    },
                    "permissions": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        }
                    }
                },
                "type": "object"
            },
            "Testimonial": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "name": {
                        "type": "string"
                    },
                    "title": {
                        "description": "Localized title.",
                        "type": "string",
                        "nullable": true
                    },
                    "description": {
                        "description": "Localized description.",
                        "type": "string"
                    },
                    "image": {
                        "type": "string",
                        "format": "uri",
                        "nullable": true
                    },
                    "active": {
                        "type": "boolean"
                    }
                },
                "type": "object"
            },
            "User": {
                "properties": {
                    "id": {
                        "type": "integer",
                        "example": 12
                    },
                    "name": {
                        "type": "string",
                        "example": "Ahmed Ali"
                    },
                    "email": {
                        "type": "string",
                        "format": "email",
                        "nullable": true
                    },
                    "phone": {
                        "type": "string",
                        "nullable": true
                    },
                    "system_id": {
                        "description": "HR system identifier",
                        "type": "integer",
                        "nullable": true
                    },
                    "machine_code": {
                        "type": "string",
                        "nullable": true
                    },
                    "department_name": {
                        "type": "string",
                        "nullable": true
                    },
                    "job_title": {
                        "type": "string",
                        "nullable": true
                    },
                    "roles": {
                        "type": "array",
                        "items": {
                            "type": "string"
                        }
                    },
                    "created_at": {
                        "type": "string",
                        "format": "date"
                    }
                },
                "type": "object"
            },
            "UserExam": {
                "properties": {
                    "id": {
                        "type": "integer"
                    },
                    "user_id": {
                        "type": "integer"
                    },
                    "course_id": {
                        "type": "integer"
                    },
                    "exam_id": {
                        "type": "integer"
                    },
                    "score": {
                        "type": "integer"
                    },
                    "max_score": {
                        "type": "integer"
                    },
                    "passed": {
                        "type": "boolean"
                    },
                    "submitted_at": {
                        "type": "string",
                        "format": "date-time"
                    }
                },
                "type": "object"
            }
        },
        "responses": {
            "Unauthorized": {
                "description": "Missing or invalid bearer token",
                "content": {
                    "application/json": {
                        "schema": {
                            "$ref": "#/components/schemas/ErrorResponse"
                        }
                    }
                }
            },
            "Forbidden": {
                "description": "Caller is authenticated but not allowed to perform this action",
                "content": {
                    "application/json": {
                        "schema": {
                            "$ref": "#/components/schemas/ErrorResponse"
                        }
                    }
                }
            },
            "NotFound": {
                "description": "Resource not found",
                "content": {
                    "application/json": {
                        "schema": {
                            "$ref": "#/components/schemas/ErrorResponse"
                        }
                    }
                }
            },
            "ValidationError": {
                "description": "The request body failed validation",
                "content": {
                    "application/json": {
                        "schema": {
                            "$ref": "#/components/schemas/ValidationErrorResponse"
                        }
                    }
                }
            },
            "ServerError": {
                "description": "Unexpected server error",
                "content": {
                    "application/json": {
                        "schema": {
                            "$ref": "#/components/schemas/ErrorResponse"
                        }
                    }
                }
            }
        },
        "parameters": {
            "AcceptLanguage": {
                "name": "Accept-Language",
                "in": "header",
                "description": "Locale for localized strings. Accepts `ar` or `en`. Defaults to `ar`.",
                "required": false,
                "schema": {
                    "type": "string",
                    "default": "ar",
                    "enum": [
                        "ar",
                        "en"
                    ]
                }
            },
            "Page": {
                "name": "page",
                "in": "query",
                "description": "Page number for paginated lists (1-based).",
                "required": false,
                "schema": {
                    "type": "integer",
                    "default": 1,
                    "minimum": 1
                }
            },
            "PerPage": {
                "name": "per_page",
                "in": "query",
                "description": "Items per page for paginated lists.",
                "required": false,
                "schema": {
                    "type": "integer",
                    "default": 15,
                    "maximum": 200,
                    "minimum": 1
                }
            },
            "Search": {
                "name": "search",
                "in": "query",
                "description": "Free-text search filter.",
                "required": false,
                "schema": {
                    "type": "string"
                }
            },
            "IdPath": {
                "name": "id",
                "in": "path",
                "description": "Resource identifier",
                "required": true,
                "schema": {
                    "type": "integer",
                    "minimum": 1
                }
            }
        },
        "securitySchemes": {
            "BearerAuth": {
                "type": "http",
                "bearerFormat": "Sanctum",
                "scheme": "bearer"
            }
        }
    },
    "tags": [
        {
            "name": "Auth",
            "description": "User & admin authentication, profile, logout"
        },
        {
            "name": "Dashboard",
            "description": "Admin dashboard statistics"
        },
        {
            "name": "Users",
            "description": "Employee / user records (HR-synced)"
        },
        {
            "name": "Admins",
            "description": "Admin user management"
        },
        {
            "name": "Roles",
            "description": "Spatie roles & permissions"
        },
        {
            "name": "Categories",
            "description": "Course categories"
        },
        {
            "name": "Instructors",
            "description": "Course instructors"
        },
        {
            "name": "Qualification Skills",
            "description": "Localized course qualification skills taxonomy"
        },
        {
            "name": "Courses",
            "description": "Course CRUD"
        },
        {
            "name": "Course Sections",
            "description": "Course content: sections"
        },
        {
            "name": "Course Lectures",
            "description": "Course content: lectures"
        },
        {
            "name": "Course Exams",
            "description": "Course content: exams"
        },
        {
            "name": "Course Assignments",
            "description": "Course content: assignments + submissions"
        },
        {
            "name": "Course Sessions",
            "description": "Offline course sessions"
        },
        {
            "name": "Course Ratings",
            "description": "Per-course ratings"
        },
        {
            "name": "Lecture Questions",
            "description": "Q&A on individual lectures"
        },
        {
            "name": "Lecture Progress",
            "description": "Per-user lecture progress"
        },
        {
            "name": "Online Enrollment",
            "description": "Enrolling employees in online courses"
        },
        {
            "name": "User Enrollment",
            "description": "Enrolling employees in offline courses"
        },
        {
            "name": "Attendance",
            "description": "Attendance recording & reporting"
        },
        {
            "name": "Certificates",
            "description": "Issued course completion certificates"
        },
        {
            "name": "Evaluation Categories",
            "description": "Categories used by the general evaluation system"
        },
        {
            "name": "Evaluations",
            "description": "General evaluation definitions"
        },
        {
            "name": "Course Evaluations",
            "description": "Per-course evaluation submissions"
        },
        {
            "name": "Exams",
            "description": "User exam submissions"
        },
        {
            "name": "Forms",
            "description": "Public forms + questions"
        },
        {
            "name": "User Forms",
            "description": "User-facing form fill flow"
        },
        {
            "name": "Notifications",
            "description": "Public notifications"
        },
        {
            "name": "Articles",
            "description": "CMS articles / blogs"
        },
        {
            "name": "CMS",
            "description": "About page + testimonials"
        },
        {
            "name": "Settings",
            "description": "Application settings"
        },
        {
            "name": "Progress",
            "description": "Aggregate progress reports"
        },
        {
            "name": "My",
            "description": "User-facing aggregate endpoints under /my/*"
        },
        {
            "name": "Webhooks",
            "description": "Inbound webhooks (HR system -> LMS)"
        }
    ]
}