* [Home](https://github.com/NolioApp/NolioAPI-Documentation)
* [OAuth Documentation](https://github.com/NolioApp/NolioAPI-Documentation/wiki/OAuth-2)
* [Webhook](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Webhook-mechanism)
* [API Documentation](https://github.com/NolioApp/NolioAPI-Documentation/wiki/API-Routes)
* [Nolio Media Kit](https://www.nolio.io/media_kit/)
* [FAQ](https://github.com/NolioApp/NolioAPI-Documentation/wiki/FAQ)
* [Contact us](https://github.com/NolioApp/NolioAPI-Documentation/wiki/ContactUs)## User
* [**GET** /get/user/](User-Get-Profile)
* [**GET** /get/user/meta/](User-Get-Metadata)
* [**GET** /get/athletes/](User-Get-Athletes)

## File
* [**POST** /upload/file/](File-Upload)

## Metrics
* [**GET** /get/metric/]
* [**POST** /update/metric/](Metrics-Create-or-Update)

## Workouts
* [**GET** /get/training/](Retrieve-Workouts)
* [**GET** /get/planned/training/](Retrieve-Planned-Workouts)
* [**GET** /get/training/streams/](Retrieve-Streams-Workout)
* [**POST** /create/training/](Workout-Create)
* [**POST** /update/training/](Workout-Update)
* [**POST** /delete/training/](Workout-Delete)
* [**POST** /create/planned/training/](Planned-workout-create)
* [**POST** /update/planned/training/](Planned-workout-update)
* [**POST** /delete/planned/training/](Planned-workout-delete)
* [**POST** /create/competition/](Competition-Create)
* [**POST** /update/competition/](Competition-Update)
* [**POST** /delete/competition/](Competition-Delete)
* [**POST** /create/planned/competition/](Competition-workout-create)
* [**POST** /update/planned/competition/](Competition-workout-update)
* [**POST** /delete/planned/competition/](Competition-workout-delete)

## Notes
* [**GET** /get/note/](Retrieve-Note)

## Objects
* [**Metric**](Metric-Object)
* [**Training**](Training-Object)
* [**Structured Workout**](Structured-Workout)
Create competition
#### Endpoint:
  - **/create/competition/**
  - HTTP Method: **POST**

Example:
```
Production:
https://www.nolio.io/api/create/competition/
```

Same arguments than [create training](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Workout-create)Delete competition
#### Endpoint:
  - **/delete/competition/**
  - HTTP Method: **POST**

Example:
```
Production:
https://www.nolio.io/api/delete/competition/
```
Parameters :

* id_partner: integer, required. 

Example:
```json
  {
    "id_partner": 1
  }
```

### Response
Http 200 on success

### Specific status code

* 400 Bad requestUpdate competition
#### Endpoint:
  - **/update/competition/**
  - HTTP Method: **POST**

Example:
```
Production:
https://www.nolio.io/api/update/competition/
```

Same arguments than [workout update](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Workout-update)Create planned competition
#### Endpoint:
  - **/create/planned/competition/**
  - HTTP Method: **POST**

Example:
```
Production:
https://www.nolio.io/api/create/planned/competition/
```

Same arguments than [create planned training](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Planned-workout-create)Delete planned competition
#### Endpoint:
  - **/delete/planned/competition/**
  - HTTP Method: **POST**

Example:
```
Production:
https://www.nolio.io/api/delete/planned/competition/
```
Parameters :

* id_partner: integer, required. 

Example:
```json
  {
    "id_partner": 1
  }
```

### Response
Http 200 on success

### Specific status code

* 400 Bad requestUpdate planned competition
#### Endpoint:
  - **/update/planned/competition/**
  - HTTP Method: **POST**

Example:
```
Production:
https://www.nolio.io/api/update/planned/competition/
```

Same arguments than [planned workout update](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Planned-workout-update)## Request Access to API
Please fill out [the access request form](https://www.nolio.io/api/register/).

## Request Support
If you need our support, please contact us at contact [at] nolio.io or with the [contact form](https://www.nolio.io/contact/) ### How to request access to API?
> Please use [this form](https://www.nolio.io/api/register/) to contact us. We will evaluate each requests and we will get back to you as soon as we are able to.

### How to contact Nolio for support?
> Please use [this form](https://www.nolio.io/contact/) to contact us, and we will get back to you as soon as we are able to.Upload .fit or .tcx file

#### Endpoint:
  - **/upload/file/**
  - HTTP Method: **POST**

Example:
```
Production:
https://www.nolio.io/api/upload/file/
```
Parameters :

* id_partner: string, required. A unique id for the training across all your application
* format: string, required. Must be `fit` or `tcx`
* data: string, required.
  - **Base64** encoded file contents.
* title: string, optional. 
  - Optional title that will be used for the training.
* comment: string, optional.
  - Optional comment that will be added to the training. 

Example:
```json
{
    "id_partner" : 345700,
    "data": "BleKx...",
    "title": "My workout",
    "Comment": "My workout desc"
}
```

### Specific status code

* `202 Accepted`
  * Returned if the request is accepted, files upload are sent in a queue to be processed

* 400 Bad request

  * Training already imported

  * .tcx files not authorized, you need to ask permission to contact@nolio.io





**You need a special authorization to use this endpoint, ask it to contact@nolio.io**

#### Endpoint:
  - **/get/metric/**
  - HTTP Method: **GET**

Parameters :
    id: int, mandatory. the metric id

Example:
```
Production:
https://www.nolio.io/api/get/metric/?id=34
```

See [Metric](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Metric-Object)

Returns: The metric 
```json
{"date": "2020-05-15", "hour": "", "value": 64.3, "unit": "kg", "type": "Poids"}
```# Nolio Public API

## Intro

Nolio API was created to allow authenticated external third parties access or push data in Nolio. To use the API you will need the application credentials available on Nolio API Portal (requests can be made at www.nolio.io/api).

All requests to the API require a valid OAuth token, which identifies the application and the user account that the application is accessing data on behalf of.

* [OAuth Documentation](https://github.com/NolioApp/NolioAPI-Documentation/wiki/OAuth-2)
* [API Documentation](https://github.com/NolioApp/NolioAPI-Documentation/wiki/API-Routes)
* [Nolio Media Kit](https://www.nolio.io/media_kit/)

A valid access token is requires for every API request. Requests must be made over an HTTPS connection and include an Authorization header of type Bearer with your access token value.

## API calls

A valid access token is requires for every API request. Requests must be made over an HTTPS connection and include an Authorization header of type Bearer with your access token value.

```
POST /api/upload/file/ HTTP/1.1
Host: www.nolio.io
Content-Type: application/json
Authorization: Bearer xBBBBvkia...
Accept: application/json
```

**Note the space between Bearer and the token.**

API requests are made using JSON data passing a `Content-Type` of `application/json` and `Accept header` of `application/json`. By default all API requests will return JSON data.

## Production system

When access to Nolio API is granted, you will be able to directly call our production server with your development app. 
Ask for more informations by [contacting us](https://github.com/NolioApp/NolioAPI-Documentation/wiki/ContactUs)

## Rate limits

Nolio API usage is limited to avoid too many calls on our servers.

There is an hour limit and a daily limit.

### Development app (and new apps) :

* 200 requests per hour
* 2000 requests per day

### Production app

* 500 requests per hour + 20 * <number_of_users_synced_with_your_app>

* 5000 requests per day + 100 * <number_of_users_synced_with_your_app>

Production application is disabled by default, you need to contact us when you want to enable it after testing with development apps.

Note that requests violating the short term limit will still count toward the long term limit.

Please contact us if you think the rate limits do not suits your usage, we can increase them.

### Retry logic

You must implements your own logic if a request failed for any reason (429 too many requests, …)


# API response status code

The API will respond to requests using HTTP status codes. Below are some common status codes your application may receive:

* 2XX - Status codes in the 200 range denote success.
  * A status of 200 (OK) is typical, but the documentation for each endpoint may specify other successful status codes in this range.
* 302 - Object moved.
  * Typically returned by the API if your request is made over an insecure HTTP connection.
* 4XX - Status codes in the 400 range denote client errors. Common responses include:
* 400 - Bad request - bad or missing data was passed to the endpoint.
* 401 - Unauthorized - bad, expired or missing authorization header.
* 403 - Forbidden - wrong token or other non allowed access
* 405 - Method not allowed
* 429 - Too Many Requests - Will trigger if you do more request than your rate limit, please read [Rate limits](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Home/_edit#rate-limits)

* 500 - Server Error.
  * If a status code 500 is returned there was an error on the server processing your request. Server errors are recorded and the servers are monitored for errors.
* 502 - Bad gateway - Can happen if a severe crash on our end, you should retry your request later.
* 503 - Service Unavailable.
  * If you receive a status code of 503 our system is temporarily unavailable, most likely for system maintenance. You should retry your request later.

For more information see the [HTTP RFC for HTTP status codes](http://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html).
All metrics value are stored as integers

| Nolio Metric          | Metric Id | Metric Type | Unit               |
|-----------------------|-----------|-------------|--------------------|
| Sleep                 | 1         | Duration    | seconds            |
| Weight                | 2         | Numeric     | kg                 |
| Body fat percent           | 3         | Numeric     | %                  |
| Max heartrate        | 4         | Numeric     | bpm                |
| Maximal Aerobic Speed (VMA in French) | 5         | Numeric     | km/h                |
| Maximal Aerobic Power (PMA in French) | 6         | Numeric     | watts               |
| FTP                   | 7         | Numeric     | watts               |
| VO2MAX                | 8         | Numeric     | ml/min/kg          |
| Resting heartrate    | 9         | Numeric     | bpm                |
| rFTP (running FTP)   | 28        | Numeric     | watts |Create or update a Nolio user metric

* If no metric exists for a given date, a new metric will be created

* If a metric exists for a given date, the metric will be updated

#### Endpoint:
  - **/update/metric/**
  - HTTP Method: **POST**

Example:
```
Production:
https://www.nolio.io/api/update/metric/
```
Parameters :

* metric_id: integer, required. The id for the corresponding Nolio [metric](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Metric-Object)
* new_value: integer, required.
* date_start: string, required. date of the metric. YYYY-MM-DD format 

Example:
```json
  {
    "metric_id": 1,
    "new_value": 3600,
    "date_start": "2020-08-31"
  }
```

### Response
A JSON containing the metrics data that was created or updated

### Specific status code

* 400 Bad request

  * metric_id doesn’t correspond to any metric





# API Authentication & Authorization
Nolio API uses the OAuth 2.0 protocol for authentication and authorization. Each application is assigned a `client_id` and `client_secret` and scopes that are authorized on the platform. Your application can then request authorization for a user. Once the user has granted authorization, the system will issue _short lived per user access and refresh tokens. The access token is used by your application to make requests until it expires and the refresh token is used to get an un updated access token.

![](https://developer.withings.com/oauth2/img/OauthDiagram.jpg)

There are many [OAuth2 client libraries](http://oauth.net/2/) available for you to use in your application.

**IMPORTANT**: The Nolio platform calls (OAuth and API) are resricted to _**HTTPS**_ requiring all all communication must be done over a secure SSL channel. HTTP requests made over a non-secure will return a HTTP 302 redirect to HTTPS.

## OAuth URLs

| System | Type | URL | Purpose |
| :-- | :-- | :- | -- |
| Production | Authorize | https://www.nolio.io/api/authorize/ | Being the authorize flow |
| | Token Exchange | https://www.nolio.io/api/token/ | Exchange a code for a token |
| | Deauthorize | https://www.nolio.io/api/deauthorize/ | Remove user authorizations |


## Authenticating Your Application on Behalf of a User
To access resources on behalf of a user, your application needs to get explicit permission from the user via a 3-legged authentication flow:

1. Make GET request to authorize endpoint with following parameters.  Each of the parameter values should be urlencoded.  The user should be redirected to the Nolio authentication flow.

    | Parameter | Value |
    | :-- | -- |
    | `response_type` | Must have the value `code` to obtain the authorization code |
    | `client_id` | Unique application identifier obtained from Nolio |
    | `redirect_uri` | URI where to redirect the user after permission is granted. It must match the callback you setup on Nolio API| 

Please note that 'scope' is not a parameter we ask for currently, all routes will be accessible by default.
 
``` http
For example, if your oauth information is below:  
client_id: my_client_identifier    
redirect_uri: https://myplatform.com/callback  

GET request to the authorize endpoint should look like:  
    
GET https://www.nolio.io/api/authorize/?response_type=code&client_id=my_client_identifier&redirect_uri=https%3A%2F%2Fmyplatform.com%2Fcallback 
```
    
2. If the user is not logged in, they will be asked to enter their username and password and upon successful login the workflow will continue.

3. The user will be prompted with a screen to approve data access to your application

4. Once scopes are granted, the request will be redirected back to the `redirect_uri` passed with the authorization `code` as a URL query parameter. For example: http://myplatform.com/?code=ABC123. The authorization code returned expires in 10 minutes or the next step will fail. **Important** the code passed to your application will be _url encoded_ and typically must be _url decoded_ before being passed in the next step.

5. Last step is for your application to exchange the authorization code for access and refresh tokens.
The application must make an HTTPS POST to the token URL passing the following `application/x-www-form-urlencoded` parameters:

    | Parameter | Value |
    | :-- | -- |
    | `grant_type` | must have the value `authorization_code` to exchange the token |
    | `redirect_uri` | URI must match the redirect_uri used in the initial step |
    | `code` | The authorization code previously returned |

You must as well add `Authorization` header as `Basic` and `client_id:client_secret` encoded as base64

Example: for client_id=toto, client_secret=tata

``` http
POST /api/token/ HTTP/1.1
Authorization: Basic dG90bzp0YXRh
Host: www.nolio.io
Content-Type: application/x-www-form-urlencoded
Content-Length: 112

grant_type=authorization_code&code=ABC123&redirect_uri=https%3A%2F%myplatform.com%3A8080%2Fcallback
```

`dG90bzp0YXRh = toto:tata encoded as base64`

6. The Nolio OAuth server will return a JSON object with the access token, refresh token, access token expiration in seconds, and the scope (`read write` always for now). The response will looks similar to the following:

    ```json
    HTTP/1.1 200 OK
    Content-Type: application/json; charset=utf-8
    {
        "access_token" : "gAAAAMYien...",
        "token_type" : "bearer",
        "expires_in" : 86400,
        "refresh_token" : "i7ne!IAAA...",
        "scope": "read write"
    }
    ```

## Refreshing an Access Token
Access tokens are short lived and will expire after a brief period (24h currently). When the token is granted the `expires_in` value contains the number of seconds the token is valid from issue. Using an expired access token will result in the API call returning an HTTP 401 Unauthorized response. Once expired your application will need to make a request using the access token and refresh token to get a new valid token.

To refresh an access token make an HTTP POST call to the token endpoint passing the following `application/x-www-form-urlencoded` parameters:

| Parameter | Value |
| :-- | -- |
| `grant_type` | Grant type must have the value `refresh_token`. i.e `grant_type=refresh_token` |
| `refresh_token` | The refresh token received when the token was issued |

You must as well add `Authorization` header as `Basic` and `client_id:client_secret` encoded as base64 (same as of the first time to get a token)

Example: for client_id=toto, client_secret=tata

``` http
POST /api/token/ HTTP/1.1
Authorization: Basic dG90bzp0YXRh
Host: www.nolio.io
Content-Type: application/x-www-form-urlencoded
Content-Length: 56

grant_type=refresh_token&refresh_token=9OjmAE7BSj1Cqsv6u
```

`dG90bzp0YXRh = toto:tata encoded as base64`

Successful execution of this call is a HTTP 200 response containing the new access token in the same format as the previous token. A HTTP 400 response may be returned if the user revokes authorization for your application, which will require re-authentication of your application for the user using the previously described flow.  

### Deauthorization
If you need to deauthorize a user you can POST a request to the deauthorize endpoint. Include the authorization header with the bearer token as you would with any other authenticated api request. Create planned training
#### Endpoint:
  - **/create/planned/training/**
  - HTTP Method: **POST**

Example:
```
Production:
https://www.nolio.io/api/create/planned/training/
```
Parameters :

* id_partner: integer, required. 
* sport_id: integer, required. The id of the [Nolio sport](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Training-Object#sport-map)
* name: string, required.
* date_start: string, required. date of the workout. YYYY-MM-DD format
* description: string, optional. additional comment to understand what to do during this workout
* duration: integer, optional. Duration of training in seconds.
* rpe : integer, optional. [Nolio rpe](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Training-Object#rpe-map)
* distance : integer, optional. distance in km
* elevation_gain : integer, optional. elevation gain in m
* structured_workout : Array, optional. see [Structured workout](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Structured-Workout)

Example:
```json
  {
    "id_partner": 1,
    "sport_id": 23,
    "name": "my planned training",
    "date_start": "2022-08-01",
    "duration": 36000,
    "rpe": 5,
    "distance": 50,
    "elevation_gain": 150
  }
```

### Response
A JSON containing the training data that was created

### Specific status code

* 400 Bad request

  * Training already existsDelete training planned
#### Endpoint:
  - **/delete/planned/training/**
  - HTTP Method: **POST**

Example:
```
Production:
https://www.nolio.io/api/delete/planned/training/
```
Parameters :

* id_partner: integer, required. 

Example:
```json
  {
    "id_partner": 1
  }
```

### Response
Http 200 on success

### Specific status code

* 400 Bad requestUpdate planned training
#### Endpoint:
  - **/update/planned/training/**
  - HTTP Method: **POST**

Example:
```
Production:
https://www.nolio.io/api/update/planned/training/
```
Parameters :

* id_partner: integer, required. 
* sport_id: integer, required. The id of the [Nolio sport](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Training-Object#sport-map)
* name: string, required.
* date_start: string, required. date of the workout. YYYY-MM-DD format
* description: string, optional. additional comment to understand what to do during this workout
* duration: integer, optional. Duration of training in seconds.
* rpe : integer, optional. [Nolio rpe](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Training-Object#rpe-map)
* distance : integer, optional. distance in km
* elevation_gain : integer, optional. elevation gain in m
* structured_workout : Array, optional. see [Structured workout](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Structured-Workout)

Example:
```json
  {
    "id_partner": 1,
    "sport_id": 23,
    "name": "my planned training",
    "date_start": "2022-08-01",
    "duration": 36000,
    "rpe": 5,
    "distance": 50,
    "elevation_gain": 150
  }
```

### Response
A JSON containing the training data that was updated

### Specific status code

* 400 Bad request# Research Project API Documentation

## Overview

The "Research Project" API is designed to manage participants, trainings, competitions, and metrics in a sports research context. It offers functionalities for creating, retrieving, updating, and deleting information related to these domains.

## Security and Authentication

To interact with the "Research Project" API, it is necessary to include an authentication header in every request. This mechanism ensures that only authorized users can access the API features.

### API Secret Key

Each request to the API must include an `Authorization` header containing the research team's secret key. This process is managed by the `research_token` decorator, which validates the secret key for each request.

#### Example of Authentication Header:

```bash
curl -X GET https://www.nolio.io/api/research/participants/ \
    -H "Authorization: Bearer YOUR_SECRET_KEY"
```


### Participants
- **GET `/api/research/participants/`**  
  Retrieves the list of participants.

### Groups

- **`GET /groups/`**

```json
{
  "groups": [
    {
      "id": 1,
      "name": "Control",
      "participants": [123, 456]
    }
  ]
}
```

- **`POST /update/groups/`**

Assign / remove users in bulk. After the API call, `users` will be in and only in `groups`

Exemple of body of POST to send

```json
{
  "users": [123,456],   // required – participant IDs
  "groups": [1,3]       // required – group IDs
}
```

Returns **201** with empty body.

---

### Create message

- **POST `/create/message/`** 

Send messages from the team manager to athletes or groups.

Body parameters:

| Field               | Type   | Required | Notes                      |
| ------------------- | ------ | -------- | -------------------------- |
| `content_message`   | string | ✓        | Message body               |
| `read_only`         | bool   |          | Defaults to `false`        |
| `send_individually` | bool   |          | `true` → 1 thread per user |
| `ids_to`            | int[]  | (1)      | Participant IDs            |
| `ids_group_to`      | int[]  | (1)      | Group IDs                  |

*(1) Exactly **one** of `ids_to` or `ids_group_to` must be provided.*

Returns **201** empty body.

### Training and Competition
- **GET `/api/research/<training|competition>/<int:user_id>/`**  
  Retrieves trainings for a specific user.

- **GET `/api/research/training/<int:pk>/streams/`**  
  Retrieves data streams for a specific training.

### Notes
- **GET `/api/research/notes/<int:user_id>/`**  
  Retrieves notes for a specific user.

### Notes planned
- **GET `/api/research/planned/notes/<int:user_id>/`**  
  Retrieves notes planned for a specific user.


### Metrics
- **GET `/api/research/metrics/<int:user_id>/`**  
  Retrieves metrics for a specific user.

### Planned Training and Competition
- **GET `/api/research/planned/<training|competition>/<int:user_id>/`**  
  Retrieves trainings planned for a specific user.


- **POST `/api/research/create/<training|competition>/planned/<int:user_id>/`**
  Creates a planned training or competition for a user.  
  - **Body Parameters:**  
    - `id_partner`: Integer, required.  
    - `name`: String, required.  
    - `sport_id`: Integer, required.  
    - `date_start`: Date in YYYY-MM-DD format, required.  
    - `plan_id`: Integer, optional.

- **POST `/api/research/update/<training|competition>/planned/<int:user_id>/`**
  Updates a planned training for a user.  
  - **Body Parameters:** Similar to create endpoint.

- **POST `/api/research/delete/<training|competition>/planned/<int:user_id>/`**
  Deletes a planned training for a user.  
  - **Body Parameters:**  
    - `id_partner`: Integer, required.

### Training Plans
- **POST `/api/research/create/trainingplan/`**  
  Creates a training plan.  
  - **Body Parameters:**  
    - `name`: String, required.

- **POST `/api/research/update/trainingplan/<int:user_id>/<int:plan_id>/`**  
  Updates a training plan.  
  - **Body Parameters:**  
    - `name`: String, required.

- **POST `/api/research/delete/trainingplan/<int:user_id>/<int:plan_id>/`**  
  Deletes a training plan.

Note: A training plan allows grouping several planned training sessions under the same entity. It starts with creating a plan, then injecting the plan's ID into the desired planned sessions using the planned session update endpoint. Deleting a training plan will remove all the planned sessions associated with that plan.

### Create a planned workout
To create a planned workout, you can use the following `curl` command:

```bash
curl -X POST https://www.nolio.io/api/research/create/training/planned/<user_id>/ \
    -H "Content-Type: application/json" \
    -d '{
        "id_partner": 42,
        "name": "Workout name",
        "sport_id": 23,
        "date_start": "2023-12-01",
        "plan_id": 42
    }'
```

## Available Metric Types

The API supports a variety of metric types for detailed tracking and analysis. Below is a list of the available metric types:

### Body Metrics
- **Weight**: Reflects the body weight of the user.
- **Fat Content**: Indicates the body fat percentage.

### Heart Rate Metrics
- **Max Heart Rate**: The maximum heart rate achieved.
- **Max Heart Rate (Bike)**: The maximum heart rate achieved specifically during biking.
- **Resting Heart Rate**: The heart rate when the user is at rest.
- **Heart Rate Recovery (HRR)**: Measures the rate of recovery after exercise.
- **RMSSD**: Root Mean Square of Successive Differences, a measure of heart rate variability.

### Performance Metrics
- **Maximal Aerobic Speed (VMA)**: Indicates the aerobic capacity during intense exercise.
- **VO2 Max**: The maximum rate of oxygen consumption measured during incremental exercise.
- **Maximal Aerobic Power (PMA)**: Indicates the aerobic power.
- **Functional Threshold Power (FTP)**: The highest power that a user can maintain in a steady state for an hour (for cycling).
- **Functional Threshold Power (Run)**: Similar to FTP but for running.

### Sleep Metrics
- **Sleep Duration**: Total duration of sleep.
- **Sleep Quality Score**: A score representing the overall quality of sleep.
- **Light Sleep Duration**: Duration of light sleep phase.
- **Deep Sleep Duration**: Duration of deep sleep phase.
- **REM Sleep Duration**: Duration of REM (Rapid Eye Movement) sleep phase.
- **Awake Duration**: Duration of time spent awake during sleep.

### Wellness Metrics
- **Body Battery Level**: Indicates the body's energy reserves.
- **Number of Recharges**: The frequency of recharge or rest periods.
- **Oura Readiness Score**: Readiness score from Oura Ring data.
- **Whoop Readiness Score**: Readiness score from Whoop data.
- **Nolio HRV Score**: Heart rate variability score calculated by Nolio.
**You need a special authorization to use this endpoint, ask it to contact@nolio.io**

#### Endpoint:
  - **/get/note/**
  - HTTP Method: **GET**

Parameters :

    note_type: string, optional, filter specific note type, see below
    id: int, optional. if you already have a note id you can put here to get only that note
    limit: integer, optional, default = 30 : maximum number of workouts returned
    from: string, optional, date format: "YYYY-MM-DD" : get all workouts after this date
    to: string, optional, date format: "YYYY-MM-DD", can be combined with from : get all workouts before this date
    athlete_id: integer, optional, default = current user. can be used to retrieve data from one of your managed athlete, you can retrieve the ids with the Get_athletes route -> https://github.com/NolioApp/NolioAPI-Documentation/wiki/User-Get-Athletes


Returned notes are ordered from the last one


Example:
```
Production:
https://www.nolio.io/api/get/note/?from=2021-04-03&to=2021-04-04&limit=2&note_type=blessure
```
## Possible note type

    'blessure' 
    'dispo'
    'inconfort'
    'goal'
    'indispo'
    'malade'
    'menstruel'
    'repos'


Returns: An athlete’s note
```json
[{
"nolio_id": 819948, 
"name": "Covid19", 
"type": "Malade", 
"date_start": "2024-10-28", 
"hour_start": "", 
"description": "", 
"sick_type": "Covid19"
}]
```**You need a special authorization to use this endpoint, ask it to contact@nolio.io**

#### Endpoint:
  - **/get/planned/training/**
  - HTTP Method: **GET**

Parameters :

    limit: integer, optional, default = 30 : maximum number of workouts returned
    id: int, optional. if you already have a planned_training id you can put here to get only that planned training
    from: string, optional, date format: "YYYY-MM-DD" : get all workouts after this date
    to: string, optional, date format: "YYYY-MM-DD", can be combined with from : get all workouts before this date


Returned workouts are ordered from the last one


Example:
```
Production:
https://www.nolio.io/api/get/planned/training/?from=2021-04-03&to=2021-04-04&limit=2
```

See [Training](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Training-Object)

Returns: An athlete’s planned workouts
```json
[
  {
    "nolio_id": 6688558,
    "name": "50km bretagne",
    "sport": "Trail",
    "sport_id": 52,
    "date_start": "2023-03-25",
    "hour_start": "",
    "duration": 0,
    "distance": 0,
    "rpe": 0,
    "description": "",
    "elevation_gain": 0,
    "elevation_loss": 0,
    "load_foster": 0,
    "load_coggan": 0,
    "is_competition": true
  },
  {
    "nolio_id": 6688556,
    "name": "LIT 12km",
    "sport": "Course à pied",
    "sport_id": 2,
    "date_start": "2023-03-23",
    "hour_start": "",
    "duration": 0,
    "distance": 12.0,
    "rpe": 2,
    "description": "",
    "elevation_gain": 0,
    "elevation_loss": 0,
    "load_foster": 0,
    "load_coggan": 27.0,
    "is_competition": false,
    "structured_workout": [
      {
        "step_duration_type": "distance",
        "step_duration_value": 3000,
        "target_value_max": 3.45303867410221,
        "target_value_min": 2.5322283610082876,
        "intensity_type": "warmup",
        "target_type": "pace"
      },
      {
        "type": "repetition",
        "value": 3,
        "steps": [
          {
            "step_duration_type": "distance",
            "open_duration": true,
            "step_duration_value": 4000,
            "target_value_max": 4.235727440232044,
            "target_value_min": 4.05156537761326,
            "intensity_type": "active",
            "target_type": "pace"
          },
          {
            "step_duration_type": "distance",
            "step_duration_value": 500,
            "target_value_max": 3.6832412523756908,
            "target_value_min": 2.992633517555249,
            "target_type": "pace"
          }
        ]
      }
    ]
  },
  {
    "nolio_id": 6688554,
    "name": "tempo-Z2 (recyclage des lactates)",
    "sport": "Course à pied",
    "sport_id": 2,
    "date_start": "2023-03-21",
    "hour_start": "",
    "duration": 4800,
    "distance": 17.389,
    "rpe": 5,
    "description": "But de la séance :\\xa0Cette séance alterne 2 intensités différentes pour accumuler du lactate afin de renforcer la progression et repousser le seuil de fatigue.L'alternance de stimulation à pour but d'améliorer le recyclage du lactate.",
    "elevation_gain": 0,
    "elevation_loss": 0,
    "load_foster": 400.0,
    "load_coggan": 80.0,
    "is_competition": false,
    "structured_workout": [
      {
        "step_duration_type": "duration",
        "step_duration_value": 900,
        "target_value_max": 3.45303867410221,
        "target_value_min": 2.5322283610082876,
        "target_type": "pace"
      },
      {
        "type": "repetition",
        "value": 4,
        "steps": [
          {
            "type": "repetition",
            "value": 4,
            "steps": [
              {
                "step_duration_type": "duration",
                "step_duration_value": 30,
                "target_value_max": 5.064456722016575,
                "target_value_min": 4.6040515654696135,
                "intensity_type": "active",
                "target_type": "pace"
              },
              {
                "step_duration_type": "duration",
                "step_duration_value": 120,
                "target_value_max": 4.143646408922653,
                "target_value_min": 3.9134438306491712,
                "intensity_type": "active",
                "target_type": "pace"
              }
            ]
          },
          {
            "step_duration_type": "duration",
            "step_duration_value": 300,
            "target_value_max": 3.45303867410221,
            "target_value_min": 2.762430939281768,
            "target_type": "pace"
          }
        ]
      },
      {
        "step_duration_type": "duration",
        "step_duration_value": 300,
        "target_value_max": 3.45303867410221,
        "target_value_min": 2.5322283610082876,
        "target_type": "pace"
      }
    ]
  }
]
```**You need a special authorization to use this endpoint, ask it to contact@nolio.io**

#### Endpoint:
  - **/get/training/streams/**
  - HTTP Method: **GET**

Parameters :

    id: integer, required (nolio_id workout)

nolio_id can be retrieve through [/get/training/](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Retrieve-Workout) endpoint

Example:
```
Production:
https://www.nolio.io/api/get/training/streams/?id=4998195
```

Returns: Workout streams data
```json
{
  "file_url": "<file_url>",
  "stream_heartrate": [
    149, 152, 153, 150, 150, 153, 153, 151, 152
  ],
  "stream_torque": [
    ...
  ],
  "stream_watts": [
    ...
  ],
  "stream_cadence": [
    ...
  ],
  "stream_pace": [
    ...
  ],
  "stream_altitude": [
    ...
  ],
  "stream_distance": [
    ...
  ],
  "stream_time": [
    ...
  ]
}
```**You need a special authorization to use this endpoint, ask it to contact@nolio.io**

#### Endpoint:
  - **/get/training/**
  - HTTP Method: **GET**

Parameters :

    limit: integer, optional, default = 30 : maximum number of workouts returned
    id: int, optional. if you already have a training id you can put here to get only that training
    from: string, optional, date format: "YYYY-MM-DD" : get all workouts after this date
    to: string, optional, date format: "YYYY-MM-DD", can be combined with from : get all workouts before this date
    athlete_id: integer, optional, default = current user. can be used to retrieve data from one of your managed athlete, you can retrieve the ids with the Get_athletes route -> https://github.com/NolioApp/NolioAPI-Documentation/wiki/User-Get-Athletes


Returned workouts are ordered from the last one


Example:
```
Production:
https://www.nolio.io/api/get/training/?from=2021-04-03&to=2021-04-04&limit=2
```

See [Training](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Training-Object)

Returns: An athlete’s workouts
```json
[
  {
    "nolio_id": 4998195,
    "name": "CaP - Fartleck Trail",
    "sport": "Running",
    "sport_id": 2,
    "date_start": "2021-04-04",
    "duration": 4109,
    "distance": 11.97,
    "rpe": 5,
    "feeling": 4,
    "description": "The place to be",
    "load_foster": 342.4166666666667,
    "load_coggan": 68.48333333333332,
    "rest_hr_user": 50,
    "rest_max_user": 190,
    "np": 0,
    "ftp": 305.0,
    "rftp": 0,
    "weight": 66.0,
    "critical_power": 303.0,
    "wbal": 22000.0,
    "file_url": "<file_url>",
    "planned_name": "CaP - Fartleck Trail",
    "planned_sport": "Running",
    "planned_sport_id": 2,
    "planned_description": "",
    "planned_load_coggan": 0
  },
  {
    "nolio_id": 4986055,
    "name": "Bike",
    "sport": "Bike",
    "sport_id": 14,
    "date_start": "2021-04-03",
    "duration": 12965,
    "distance": 77.71,
    "rpe": 3,
    "feeling": 4,
    "description": "",
    "load_foster": 648.25,
    "load_coggan": 131.65223201172338,
    "rest_hr_user": 50,
    "rest_max_user": 180,
    "np": 184.40765380859375,
    "ftp": 305.0,
    "rftp": 0,
    "weight": 66.0,
    "critical_power": 303.0,
    "wbal": 22000.0,
    "file_url": "<file_url>",
    "planned_name": "Bike",
    "planned_sport": "Bike,
    "planned_sport_id": 14,
    "planned_description": "",
    "planned_load_coggan": 0
  }
]
```# Nolio Public Workout Format

This format expose structured workouts through the Nolio public API.  
A workout is represented as an **array of steps**, where each step can be one of the following types:  
- **atomic step**  
- **repetition**  
- **exercise**  
- **superset**  

---

## 1) Atomic step

| field               | type                              | optional | description                                                                 |
|---------------------|-----------------------------------|----------|-----------------------------------------------------------------------------|
| step_duration_type  | `"duration" \| "distance"`        | yes      | distance or duration                                                        |
| open_duration       | `boolean`                         | yes      |                                                 |
| step_duration_value | `number`                          | yes      | value in seconds or meters                                                  |
| target_value_max    | `number`                          | yes      | upper bound of the target                                                   |
| step_percent_low    | `number`                          | yes      | lower percent bound of the target                                                   |
| step_percent_high    | `number`                          | yes      | upper percent bound of the target                                                   |
| target_value_min    | `number`                          | yes      | lower bound of the target                                                   |
| rpe                 | `number`                          | yes      | rate of perceived exertion                   |
| rir                 | `number`                          | yes      | repetitions in reserve (only for Exercise)                                                      |
| manual_values                 | `boolean`                          | yes      | True when values are set manually|
| intensity_type      | `string`                          | yes      | normalized intensity                                   |
| target_type         | `string`                          | yes      | type of target: may be the `unit`, `"rir"`, `"rpe"`, or a metric (pace, hr) |
| name             | `string`                          | yes      | name of the target                                                                |
| secondary_step      | `atomic step`                     | yes      | secondary target if provided (e.g., cadence + power)                        |
| comment             | `string`                          | yes      | free note                                                                   |

---

## 2) Repetition

| field | type          | optional | description                      |
|-------|---------------|----------|----------------------------------|
| type  | `"repetition"`| no       | node type                        |
| value | `number`      | no       | number of repetitions            |
| steps | `array<step>` | no       | repeated content (any step type) |

---

## 3) Exercise

| field        | type          | optional | description        |
|--------------|---------------|----------|--------------------|
| type         | `"exercise"`  | no       | node type          |
| name         | `string`      | yes      | exercise name      |
| instructions | `string`      | yes      | exercise notes     |
| thumbnail_url| `string`      | yes      | thumbnail image    |
| media_url    | `string`      | yes      | media (e.g., video)|
| sets         | `array<set>`  | no       | exercise sets      |

### Set (inside `exercise.sets`)

| field       | type                               | optional | description                         |
|-------------|------------------------------------|----------|-------------------------------------|
| type        | `"rep" \| "distance" \| "duration"`| no       | set type                            |
| rest        | `number`                           | yes      | rest time in seconds                 |
| targets     | `array<atomic step>`               | no       | 1 or 2 targets                      |
| repetitions | `number`                           | yes      |                    |
| distance    | `number`                           | yes      | in meters  |
| duration    | `number`                           | yes      | in seconds |
| tempo       | `string`                           | yes      | tempo notation (e.g., `"3-1-2"`)     |

---

## 4) Superset

| field     | type              | optional | description           |
|-----------|-------------------|----------|-----------------------|
| type      | `"superset"`      | no       | node type             |
| exercises | `array<exercise>` | no       | list of exercises     |






***




**Format type: json**

Example 1
``` json
{
  "structured_workout": [
    {
      "intensity_type": "warmup",
      "step_duration_type": "duration",
      "step_duration_value": 600,
      "type": "step",
      "target_type": "power",
      "target_value_min": 200,
      "target_value_max": 250,
      "open_duration": true,
      "comment": "Hello world\nFrom API"
    },
    {
      "type": "repetition",
      "value": 3,
      "steps": [
        {
          "intensity_type": "active",
          "step_duration_type": "duration",
          "step_duration_value": 180,
          "type": "step",
          "target_type": "power",
          "target_value_min": 300,
          "target_value_max": 350
        },
        {
          "intensity_type": "rest",
          "step_duration_type": "duration",
          "step_duration_value": 180,
          "type": "step",
          "target_type": "no_target"
        }
      ]
    },
    {
      "intensity_type": "cooldown",
      "step_duration_type": "distance",
      "step_duration_value": 5000,
      "type": "step",
      "target_type": "heartrate",
      "target_value_min": 100,
      "target_value_max": 150,
      "open_duration": true
    }
  ]
}
```

1. Valid Enum Values
   * intensity_type: 
     * warmup
     * cooldown
     * active
     * rest
     * ramp_up
     * ramp_down

   * step_duration_type:
     * duration
     * distance

   * type:
     * repetition
     * step

   * target_type
     * pace
     * speed
     * power
     * heartrate
     * no_target

2. Units

|||
|----------|:-------------:|
| step_duration_value |  meter or second |
| heartrate |    bpm   |
| power | W |
| speed | km/h |
| pace | mps (meters/s)|
| cadence | rpm |

3. Notes

   * **step_duration_value** values are integers.
   * If target_type is not "no_target", target_value_max is mandatory, but target_value_min is optional. If both target_value_min and target_value_max are completed, target will be a range of [target_value_min, target_value_max], otherwise it will be a target of target_value_max
   * For open duration steps you can add "open_duration" : true to a step.
   * You can add linebreaks on the comment field with \n

     




 


* [Training map](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Training-Object#training-map)
* [Sport map](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Training-Object#sport-map)
* [Feeling map](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Training-Object#feeling-map)
* [RPE map](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Training-Object#rpe-map)

## Training map (for manual creation)

| Parameter      | Type    | Unit         | Required |
|----------------|---------|--------------|----------|
| id_partner     | Integer |              | true     |
| sport_id       | Integer |              | true     |
| name           | String  |              | true     |
| date_start     | Date    |              | true     |
| description    | String  |              |          |
| duration       | Integer | seconds      |          |
| sensation      | Integer | from 1 to 5  |          |
| rpe            | Integer | from 1 to 10 |          |
| distance       | Integer | kilometers   |          |
| elevation_gain | Integer | meters       |          |

## Training map (for retrieving)

| Parameter      | Type    | Unit         | Comment  |
|----------------|---------|--------------|----------|
| nolio_id       | Integer |              | can be used for other endpoint where <nolio_id> is required     |
| name           | String  |              |      |
| sport           | String  |              |      |
| sport_id           | Integer  |              | Nolio sport_id   |
| date_start     | Date    |              | YYYY-MM-DD format |
| hour_start     | Date    |              | HH:MM:SS format |
| description    | String  |              |          |
| duration       | Integer | seconds      |          |
| distance       | Float | kilometers   |          |
| rpe            | Integer | from 1 to 10 |          |
| feeling        | Integer | from 1 to 5  |          |
| elevation_gain | Integer | meters       |          |
| load_foster | Float |        |          |
| load_coggan | Float |        |          |
| rest_hr_user | Integer | bpm       | Workout user resting heartrate (not during the workout)        |
| max_hr_user | Integer | bpm       | Workout user maximum heartrate (not during the workout)      |
| np | Float | W       | Power adjusted         |
| ftp | Float | W       |          |
| rftp | Float | W       |          |
| weight | Float | kg   |  User weight     |
| critical_power | Float | W       |          |
| wbal | Float | J       |          |
| file_url | Url |        | Url to download the .fit or .tcx file associated to the workout, **valid only for one hour**         |
| planned_name | String |  |  Planned workout name        |
| planned_sport | String |  | Planned workout sport name         |
| planned_sport_id | Integer |  | Planned workout Nolio sport_id       |
| planned_description | String |  | Planned workout description       |
| planned_load_coggan | Float |  | Planned workout Coggan load       |
| is_competition | Bool |  | Is the workout flagged as competition or not       |


## Planned Training map (for retrieving)

| Parameter      | Type    | Unit         | Comment  |
|----------------|---------|--------------|----------|
| nolio_id       | Integer |              | can be used for other endpoint where <nolio_id> is required     |
| name           | String  |              |      |
| sport           | String  |              |      |
| sport_id           | Integer  |              | Nolio sport_id   |
| date_start     | Date    |              | YYYY-MM-DD format |
| hour_start     | Date    |              | HH:MM:SS format |
| description    | String  |              |          |
| duration       | Integer | seconds      |          |
| distance       | Float | kilometers   |          |
| rpe            | Integer | from 1 to 10 |          |
| elevation_gain | Integer | meters       |          |
| load_foster | Float |        |          |
| load_coggan | Float |        |          |
| is_competition | Bool |  | Is the workout flagged as competition or not       |
| structured_workout | [Structured_workout](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Structured-Workout) |        |          |


## Training map streams
| Parameter      | Type    | Unit         |
|----------------|---------|--------------|
| stream_heartrate | Float |  bpm | 
| stream_torque | Float |  N.m | 
| stream_watts | Float |  W | 
| stream_cadence | Float |  rpm or ppm | 
| stream_pace | Float |  meters per second | 
| stream_altitude | Float |  meters | 
| stream_distance | Float |  meters | 
| stream_time | Float |  seconds | 

## Sport map
| Nolio Sport          | Sport Id |
|----------------------|----------|
| XC ski - Classic     | 3        |
| XC ski - Skating     | 4        |
| Roller ski - Classic | 5        |
| Roller ski - Skating | 6        |
| Ski Mountaineering   | 7        |
| Climbing             | 8        |
| Bodybuilding         | 10       |
| Other                | 12       |
| Road cycling         | 14       |
| Mountain cycling     | 15       |
| Hiking               | 16       |
| Virtual ride         | 18       |
| Swimming             | 19       |
| Strength             | 20       |
| Stretching           | 21       |
| Running              | 2        |
| Treadmill            | 24       |
| Kayaking - Sea       | 26       |
| Kayaking - River     | 27       |
| Elliptical trainer   | 28       |
| Walking sticks       | 29       |
| Yoga                 | 30       |
| Canoe - Sea          | 31       |
| Canoe - River        | 32       |
| Rowing               | 33       |
| Orienteering race    | 34       |
| Track cycling        | 35       |
| CX cycling           | 36       |
| Squash               | 37       |
| Biathlon             | 38       |
| Walking              | 45       |
| Stand up paddle      | 51       |
| Trail running        | 52       |
| OCR running          | 53       |
| Tennis               | 59       |

## Feeling map

| 1 | Very weak |
|---|-----------|
| 2 | Weak      |
| 3 | Normal    |
| 4 | Good      |
| 5 | Strong    |

## Rpe map

| 1  | Very easy |
|----|-----------|
| 2  | Easy      |
| 3  | Easy      |
| 4  | Moderate  |
| 5  | Moderate  |
| 6  | Hard      |
| 7  | Hard      |
| 8  | Very hard |
| 9  | Very hard |
| 10 | All out   |#### Endpoint:
  - **/get/athletes/**
  - HTTP Method: **GET**

Parameters :

* wants_coach: bool : true if you want to include coach


Example:
```
Production:
https://www.nolio.io/api/get/athletes/?wants_coach=false
```

Returns: Athlete’s profile
```json
[{
 "nolio_id": 1,
 "name": "Vincent Luis"
},
{
 "nolio_id": 2,
 "name": "Ugo Ferrari"
}]

```**You need a special authorization to use this endpoint, ask it to contact@nolio.io**

#### Endpoint:
  - **/get/user/meta/**
  - HTTP Method: **GET**

Parameters :

* limit: integer, optional, default = 15 : maximum number of values returned for each metrics type
* from: string, optional, date format: "YYYY-MM-DD" : get all metrics after this date
* to: string, optional, date format: "YYYY-MM-DD", can be combined with from : get all metrics before this date


Example:
```
Production:
https://www.nolio.io/api/get/user/meta/?limit=20
```

Returns: An athlete’s metadata (goals & metrics)

See [Training](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Training-Object)

**Date** are in **YYYT-MM-JJ** format

**Hours** are in **HH:MM** format with H in [0..24] & M in [0..59]

```json
{
   "goals":[
      
   ],
   "weight":{
      "unit":"kg",
      "data":[
         {
            "date":"2021-02-05",
            "hour":"13:30",
            "value":55.7
         },
         {
            "date":"2020-07-28",
            "hour":null,
            "value":56.5
         },
         {
            "date":"2020-05-03",
            "hour":null,
            "value":57.0
         }
      ]
   },
   "hrmax":{
      "unit":"bpm",
      "data":[
         {
            "date":"2019-02-21",
            "hour":null,
            "value":176.0
         }
      ]
   },
   "sleep":{
      "unit":"seconds",
      "data":[
         {
            "date":"2020-04-07",
            "hour":"10:00",
            "value":30600.0
         },
         {
            "date":"2020-04-07",
            "hour":"14:25",
            "value":4200.0
         },
         {
            "date":"2020-03-23",
            "hour":null,
            "value":32400.0
         }
      ]
   },
   "hrrest":{
      "unit":"bpm",
      "data":[
         {
            "date":"2019-01-14",
            "hour":null,
            "value":48.0
         }
      ]
   },
   "aerobicspeed":{
      "unit":"km/h",
      "data":[
         {
            "date":"2021-04-15",
            "hour":null,
            "value":16.5
         },
         {
            "date":"2020-07-16",
            "hour":null,
            "value":15.5
         }
      ]
   },
   "ftp":{
      "unit":"W",
      "data":[
         {
            "date":"2020-12-09",
            "hour":null,
            "value":182.0
         }
      ]
   },
   "criticalpowercycling":{
      "unit":"W",
      "data":[
         {
            "date":"2021-01-07",
            "hour":null,
            "value":183.0
         },
         {
            "date":"2020-12-09",
            "hour":null,
            "value":176.0
         }
      ]
   },
   "wbalcycling":{
      "unit":"J",
      "data":[
         {
            "date":"2021-01-07",
            "hour":null,
            "value":10800.0
         },
         {
            "date":"2020-12-09",
            "hour":null,
            "value":19200.0
         }
      ]
   }
}
```#### Endpoint:
  - **/get/user/**
  - HTTP Method: **GET**

Example:
```
Production:
https://www.nolio.io/api/get/user
```

Returns: An athlete’s profile
```json
{
 "id": 42, 
 "first_name": "Vincent",
 "last_name": "Luis"
}

```# Webhook mechanism

A webhook mechanism is available to avoid query the API to see if there's new data 

<img width="749" alt="Capture d’écran 2024-12-03 à 16 03 51" src="https://github.com/user-attachments/assets/07c8096b-add1-44c5-8774-c0db6b7df274">

You can setup the URLs where to receive the events in the Nolio API admin.

There are currently 2 webhooks
* One of for events in the achieved Calendar (Training, Note, Competition)
* One for new metrics

If you leave it blank, no webhook will be triggered.

Here's example event you will receive

For events:

``` 
{
  "notif_type": "new_event",
  "object_type": "Training",
  "object_id": 32263,
  "user_id": 10,
  "date_object": "2024-12-02"
}
``` 

For metrics: 

``` 
{
  "notif_type": "updated_metric",
  "object_type": "Metrics",
  "object_id": 10499,
  "user_id": 100,
  "date_object": "2024-12-03",
  "metric_type": "nombredepas"
}
``` 

Notif type can be
* new_event 
* updated_event
* deleted_event
* new_metric
* updated_metric
* deleted_metric


There is a webhook code on the app that is generated by default, and you can change it in the admin.
<img width="749" alt="Capture d’écran 2024-12-03 à 16 10 47" src="https://github.com/user-attachments/assets/793d7f45-1faf-4061-b390-d1448328dc01">

This code in set up as a HTTP Header in the request we will send, to verify it's coming from Nolio.

The code is set up in `http-x-nolio-key` header. Use it to discard calls you receive that do not contains the good code.
Create manual training

#### Endpoint:
  - **/create/training/**
  - HTTP Method: **POST**

Example:
```
Production:
https://www.nolio.io/api/create/training/
```
Parameters :

* id_partner: integer, required. 
* sport_id: integer, required. The id of the [Nolio sport](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Training-Object#sport-map)
* name: string, required.
* date_start: string, required. date of the metric. YYYY-MM-DD format 
* description : string, optional. 
* duration: integer, optional. Duration of training in seconds.
* feeling : integer, optional. [Nolio feeling](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Training-Object#feeling-map)
* rpe : integer, optional. [Nolio rpe](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Training-Object#rpe-map)
* distance : integer, optional. distance in km
* elevation_gain : integer, optional. elevation gain in m

Example:
```json
  {
    "id_partner": 1,
    "sport_id": 1,
    "name": "my manual training",
    "date_start": "2020-08-01",
    "duration": 36000,
    "feeling": 2,
    "rpe": 5,
    "distance": 50,
    "elevation_gain": 150
  }
```

### Response
A JSON containing the training data that was created

### Specific status code

* 400 Bad request

  * Training already existsDelete training
#### Endpoint:
  - **/delete/training/**
  - HTTP Method: **POST**

Example:
```
Production:
https://www.nolio.io/api/delete/training/
```
Parameters :

* id_partner: integer, required. 

Example:
```json
  {
    "id_partner": 1
  }
```

### Response
Http 200 on success

### Specific status code

* 400 Bad requestUpdate training

#### Endpoint:
  - **/update/training/**
  - HTTP Method: **POST**

Example:
```
Production:
https://www.nolio.io/api/update/training/
```
Parameters :

* id_partner: integer, required. 
* sport_id: integer, required. The id of the [Nolio sport](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Training-Object#sport-map)
* name: string, optional.
* date_start: string, optional. date of the metric. YYYY-MM-DD format 
* description: string, optional.
* duration: integer, optional. Duration of training in seconds.
* feeling : integer, optional. [Nolio feeling](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Training-Object#feeling-map)
* rpe : integer, optional. [Nolio rpe](https://github.com/NolioApp/NolioAPI-Documentation/wiki/Training-Object#rpe-map)
* distance : integer, optional. distance in km
* elevation_gain : integer, optional. elevation gain in m

Example:
```json
  {
    "id_partner": 1,
    "sport_id": 1,
    "name": "my manual training",
    "date_start": "2020-08-01 14:54:33",
    "description": "A recovery workout"
    "duration": 36000,
    "feeling": 2,
    "rpe": 5,
    "distance": 50,
    "elevation_gain": 150
  }
```

### Response
A JSON containing the training data that was updated

### Specific status code

* 400 Bad request

  * Training doesn’t exist

