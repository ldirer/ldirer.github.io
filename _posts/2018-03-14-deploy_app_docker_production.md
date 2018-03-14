---
layout: mysingle
title: "Deploy your app with docker and docker-compose - Part 2"
permalink: /deploy-docker-app-part-2/
---

So we developed that app locally. It's pretty! Or maybe it's not. Let's deploy it anyway!

This builds on a previous blog post on how to [set up a development environment with docker-compose](/deploy-docker-app).  
Our starting point is a dockerized development environment for a single page application with a Python Flask backend.

If you don't even want to read this but want to check the final setup, you can just [clone the repository](https://github.com/ldirer/deploy-app-docker/).

# Index

1. [Overview](#overview)
2. [Image size matters](#image-size-matters)
3. [Backend dockerfile and uwsgi configuration](#backend-dockerfile-and-uwsgi-configuration)
4. [Nginx dockerfile](#nginx-dockerfile)
5. [Using several docker-compose files](#using-several-docker-compose-files)
6. [Optimizations (leaner, faster or just better)](#optimizations-leaner-faster-or-just-better)

    1. [Base images and dockerfiles](#base-images-and-dockerfiles)
    2. [Dockerignore](#dockerignore)
    3. [More production settings: logging and restart policies](#more-production-settings-logging-and-restart-policies)

7. [Deploying with docker-machine](#deploying-with-docker-machine)
8. [Conclusion](#conclusion)


# Overview 

In development we had:

* A javascript development server (`webpack-dev-server` in our cases) serving our `index.html` and JavaScript files.
* A backend server - the Flask development server.
* A database.

In production:

1. We can't keep the javascript development server. So we need to find someone to serve our `index.html` file and the javascript bundles.
2. We need to use a Python server that is meant to be used in production. Popular choices include [gunicorn](http://gunicorn.org/) and [uWSGI](http://uwsgi-docs.readthedocs.io/en/latest/).

We solve both points by using an nginx server to serve our static files (`index.html` and the JavaScript bundles) and proxy to our Python server.

What we will do:

* Write `nginx.dockerfile` to build our nginx image. 
* Add configuration for the Python server of our choice. I picked uWSGI.
* Connect all of this in our docker-compose configuration.

# Image size matters

Deployment introduces new concerns that are non-existent when developing locally.  
For instance the **image size** starts to matter much more, since you often need to push your custom images to docker registries.  

Pushing a 1GB image over the network can take a long time or a very long time (Depending on your internet connection)[^0].  
Incidentally, lighter images also mean faster deployments.

Ways to reduce the image size include:

1. Using the `.dockerignore` file correctly.
2. Using smaller base images - like `alpine` instead of `ubuntu`.
3. Chaining commands in dockerfiles to avoid creating extra cache layers in the docker image (which take space).
4. Using multi-stage builds where relevant.

We will use all 4 of these. 
These techniques are used by a number of people, so you won't be on your own when facing a problem (Google!).


# Backend dockerfile and uwsgi configuration

We don't want to use the flask development server in production, here we will use uWSGI. 

It's important to note that **the dockerfile does not need to change**. Our application is the same, the only difference is how we launch it.  

We need a configuration file to run uWSGI, mine looks like:

<p class="ld-code-filename"><code>uwsgi.ini</code></p>

```yaml
[uwsgi]

# socket is meant to be used with nginx (not directly)
socket = :3033
buffer-size=32768
master = 1
module = backend.app
callable = app
processes = 2
threads = 2
stats = :9099
pidfile = uwsgi.pid
```

The part that makes it run is the combination of `module` and `callable` to locate our app. `socket` will also be used later on.

Now we can change `command` in our compose file to run with uwsgi:

```yaml
    web:
      command: uwsgi --ini /app/uwsgi.ini
      environment:
        - QUIZ_ENV=production
```

Note that you do need to rebuild the image after adding `uwsgi` to your `requirements.txt`.

# Nginx dockerfile

In this dockerfile we will:

* Build our javascript bundles.
* Install nginx and copy our custom configuration.

<p class="ld-code-filename"><code>deploy/nginx.dockerfile</code></p>

```dockerfile
# This image will contain the javascript code as well since it's nginx serving it.
# Using multi-stage docker build for a smaller final image.
FROM node:9.5 AS jsbuilder

COPY ./client /client
WORKDIR /client

RUN npm install
RUN npm run build

# Multi-stage means the build context needs to be the same, that's a bit disappointing (coupling!)...
FROM nginx:1.13.9-alpine

COPY deploy/nginx.conf /etc/nginx/nginx.conf

COPY --from=jsbuilder /client/dist/ app/
```

We are using [multi-stage builds](https://docs.docker.com/develop/develop-images/multistage-build/) so everything we do until the second `FROM` won't be part of the final image, except the files we `COPY --from`.  
That means we don't need to have npm and the thousands of `node_modules` in the image that we will deploy. Nice!

<div class="ld-tech-details">
{% capture text %}
To see how big of a win this is we can compare the image size with the image obtained from building just the first part:

```dockerfile
FROM node:9.5

COPY ./client /client
WORKDIR /client

RUN npm install
RUN npm run build
```

Build it and check image size:

    $ docker build -f deploy/test_multistage.dockerfile -t test_multistage ./
    [..]
    $ docker images
    REPOSITORY             TAG        IMAGE ID            CREATED             SIZE
    test_multistage        latest     d08b336471a9        3 seconds ago       843MB
    
    
If we compare this with our image size using multi-stage builds:   

    deployappdocker_nginx_1   tutorial/nginx_front   latest        2bc2b1d6aa10   10.2 MB
    
This is a HUGE difference to your life and sanity as the developer hitting the deploy button.   

Disclaimer: this is a bit of an unfair comparison. Without multi-stage builds we could have used a smaller base image than `node:9.5` (`node-alpine` for minimal effort). But then we would have had to install nginx on this base image.   
Here we get the best of both worlds.
{% endcapture %}
{{ text | markdownify }}
</div>


We are still missing our nginx configuration file. Deep breath:

<p class="ld-code-filename"><code>deploy/nginx.conf</code></p>

```nginx
# prevent from exiting in container
#daemon off;  # This is already passed as command line by the nginx dockerfile entrypoint.
worker_processes auto;

pid /run/nginx.pid;

events {
    worker_connections 512;
}

http {
    # Basic Settings

    # sendfile off in dev for no keepalive_timeout 65;
    # sendfile does not play nice with docker/VMs and cache disabling.
    sendfile off;
    types_hash_max_size 2048;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # SSL Settings
    ssl_protocols TLSv1 TLSv1.1 TLSv1.2; # Dropping SSLv3, ref: POODLE
    ssl_prefer_server_ciphers on;

    # Logging Settings
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # Gzip Settings
    gzip on;
    gzip_disable "msie6";

    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_buffers 16 8k;
    # minimum http version required for us to use compression
    gzip_http_version 1.1;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    server {
        error_log /var/log/nginx/file.log debug;

        listen          80 default_server;

        # First we try to serve the files directly (like static images or the js files).
        # If we cant we redirect to our app.
        # root should be out of location block
        root /app;
        location = / {
            # index causes a redirect so the request will be handled in the next block (as if we hit /app/index.html)
            index index.html;
        }
        location / {
            try_files $uri @app;
        }


        location @app {
            include uwsgi_params;
            # Using docker-compose linking.
            uwsgi_pass web:3033;
        }
    }
}
```

What's important in there:

1. **Compression** is enabled, so our javascript files will be much smaller on the network (faster load time for our app).
<!-- * TODO: Add caching. Ask pedro. -->
2. The docker-related part is in the final line: `uwsgi_pass web:3033`. 
This is docker-compose magic again: it sets up a network with all our containers, making them reachable using their service name.
3. I'm not an nginx expert, this is probably not the best configuration you can get (I adapted it from the uWSGI docs). 

<!-- MB add: We've already seen this when configuring webpack to proxy requests to our backend server in development. -->

What's not in there, but is even more important: you can **build and test your production setup** locally.   

<div class="ld-tech-details">
{% capture text %}
When you do this make sure to add a volume to synchronize your `nginx.conf` file (in the same way we use a volume for the python code) so you don't need to rebuild every time you tweak the configuration.  
Also beware that single-file volumes have quirks, make it a directory.
{% endcapture %}
{{ text | markdownify }}
</div>


# Using several docker-compose files

We could have a new `docker-compose.prod.yml` file with all our production configuration.  
However docker-compose can combine several files into one, which helps avoiding copy-pasted settings.

We will have three files:

* `docker-compose.yml` for the configuration that is shared between development and production.
* `docker-compose.override.yml` for development-specific configuration.
* `docker-compose.production.yml` for production-specific configuration.

This means we will run our commands by explicitly passing the `-f [config-filename]` option.  
If this option is left out, docker-compose defaults to the `docker-compose.yml` file in the current directory.

<div class="ld-tech-details">
{% capture text %}
Note that `docker-compose.override.yml` is a special file and **will be loaded by docker-compose by default**.  

```bash
# The two following commands are equivalent:
docker-compose -f docker-compose.yml -f docker-compose.override.yml up
docker-compose up

# This command is different as it won't use the `.override.yml` file
docker-compose -f docker-compose.yml up
```
{% endcapture %}
{{ text | markdownify }}
</div>


Overall you can assume docker-compose is 'smart' about merging files.  
At any point if you are unsure how the files are merged you can check it with:

    docker-compose [-f docker-compose.yml] [-f docker-compose.prod.yml] config


So the first step is to move all development-specific configuration from `docker-compose.yml` to `docker-compose.override.yml`.
We end up with a stripped-down `docker-compose.yml` file:

<p class="ld-code-filename"><code>docker-compose.yml</code></p>

```yaml
version: '3'
services:
    web:
      image: docker-tutorial/web
      build:
        context: ./
        dockerfile: deploy/web.dockerfile
      environment:
        - SQLALCHEMY_DATABASE_URI=postgresql://postgres:postgres@db:5432
        # Making production the default.
        - QUIZ_ENV=production
    db:
      image: postgres:10.2-alpine
      environment:
        - POSTGRES_USER=postgres
        - POSTGRES_PASSWORD=postgres
```


<p class="ld-code-filename"><code>docker-compose.override.yml</code></p>

```yaml
# This file adds volumes for development use. docker-compose merges them in a 'smart' way.
version: '3'
services:
    front:
      image: docker-tutorial/front
      build:
        context: ./
        dockerfile: deploy/front.dockerfile
      command: npm run dev
      volumes:
        - ./client:/app
      ports:
        - "8080:8080"
    web:
      ports:
        - "5000:5000"
      command: python manage.py runserver
      volumes:
        - ./:/app
      environment:
        - QUIZ_ENV=development
    db:
      ports:
          - "5432:5432"
```

Notable changes:

* We don't need the frontend development server in production: this is dev-specific.
* We don't want to expose ports outside of the docker network in production.  
It could be ok to expose the ports, as long as they are not exposed to the internet (blocked by some firewall/cloud provider rules). We're being extra cautious here ~~which is a good thing when your PostgreSQL credentials are postgres/postgres~~.
* **Volumes for code are only relevant for development**. Our images contain the code that will run in production (we copy it during the build).  
Using volumes might actually *break our deployment*: if we mount volumes but our code does not live on the host, we might override the code in the image with whatever the directory on the host contains.


Now the production-specific configuration:

<p class="ld-code-filename"><code>docker-compose.prod.yml</code></p>

```yaml
version: '3'
services:
    nginx:
      image: docker-tutorial/nginx_front
      build:
        context: ./
        dockerfile: deploy/nginx.dockerfile
      ports:
        - "80:80"
      depends_on:
        - web  # not optional, nginx crashes if it does not find web. It checks hostname in the startup phase.
        # Fix this: https://sandro-keil.de/blog/2017/07/24/let-nginx-start-if-upstream-host-is-unavailable-or-down/
    web:
      command: uwsgi --ini /app/uwsgi.ini
      environment:
        - QUIZ_ENV=production
    db:
      volumes:
        - /quizdata:/var/lib/postgresql/data
```

Nothing extraordinary here, note that:

* We add the `nginx` service which is production-only.  
* The `command` to start our `web` backend service has changed to use `uwsgi`.
* We use a volume for our database container. This is required to **persist data through container removal**.  
Your data will live on the host machine just like with a regular database. 

# Optimizations (leaner, faster or just better)

## Base images and dockerfiles

Our current web image is pretty big: 

    $ docker-compose images web
          Container             Repository         Tag       Image Id      Size 
    ----------------------------------------------------------------------------
    deployappdocker_web_1   docker-tutorial/web   latest   2bc106c2edfd   704 MB
    
    
We will change the base image to use the alpine distribution to cut the image size down to 250MB.

Our new dockerfile:

<p class="ld-code-filename"><code>deploy/web.dockerfile</code></p>

```dockerfile
FROM python:3.6-alpine3.7

RUN apk add --update gcc postgresql-dev && \
  apk add musl-dev && \
  # Required by uWSGI
  apk add linux-headers

# WORKDIR creates the directory if necessary.
WORKDIR /app

ADD ./requirements.txt ./

RUN pip install -r requirements.txt

ADD ./ /app

CMD python app.py
```

And the image size is much lower:

    REPOSITORY                 TAG        IMAGE ID            CREATED             SIZE
    docker-tutorial/web        latest     6ebfb51e26f7        42 seconds ago      249MB
    
    
Notice how we also used an alpine-based image for our nginx image.

<div class="ld-tech-details">
{% capture text %}
If we look at `docker images`, we can see the official `python:3.6` image our web image was previously based on:

    python  3.6                              c1e459c00dc3        2 months ago        692MB
    
So our base image was already huge: we could not have gotten significant improvements without changing it.  

The alpine distribution we picked is very popular to build images, as it is extremely lightweight.  
This comes at a cost of some building annoyances: we have to use a new package manager and all the tools we take for granted (like bash) are not on the image.   
{% endcapture %}
{{ text | markdownify }}
</div>


<!--TODO Collapseable 
Now you might say that 250MB still makes for a big image.  
To further reduce this, you can remove libs... This sucks
TODO: what can you do?
    
TODO: multi stage builds? Ask Zulip. -->


## Dockerignore

This is a cheap win.

The `.dockerignore` file is just like a `.gitignore` except it applies to the docker build context.  
The build context is passed to the image during docker build:

    # 154MB is a big context - takes time to load and it will all end up in your image if you `ADD ./`.
    $ docker build -f deploy/test_multistage.dockerfile -t test_multistage ./
    Sending build context to Docker daemon    154MB
    
Also all `ADD` and `COPY` instructions are relative to the build context, so you might end up copying irrelevant files into your image.  
Here's a basic `.dockerignore`:


<p class="ld-code-filename"><code>.dockerignore</code></p>

<!-- Using .ignore file type I get a font bigger than I like -->
```bash
client/node_modules
.git/
# This is for Jetbrains IDE config files
.idea/
```

If we try to rebuild our test image afterwards, it will start much faster:

```bash
$ docker build -f deploy/test_multistage.dockerfile -t test_multistage ./
Sending build context to Docker daemon  4.409MB
```
    
**That's it**. One file and the benefits can be huge.

<div class="ld-tech-details">
{% capture text %}
Ideally we would ignore `client/` when building `web` since it does not need it. This would save us about 4MB here.  
However if we add it to the `.dockerignore` it will also be ignored when building our `nginx` service, which is not what we want.  

I don't know how to solve this without moving the dockerfiles in different folders, adding directory-specific `.dockerignore` files and changing the build contexts accordingly.
If you have a better solution, please do <a href="/" title="Pretty please?">let me know</a>! 
{% endcapture %}
{{ text | markdownify }}
</div>

## More production settings: logging and restart policies

Let's try our best to look professional. We can:

1. Add logging to our app with file rotation so the log files don't grow indefinitely.
2. Make sure our app goes back up if the mean people from AWS reboot our instance.

This is just more docker-compose config. Here's the final file:

<p class="ld-code-filename"><code>docker-compose.prod.yml</code></p>

```yaml
version: '3'
services:
    nginx:
      image: docker-tutorial/nginx_front
      build:
        context: ./
        dockerfile: deploy/nginx.dockerfile
      ports:
        - "80:80"
      depends_on:
        - web  # not optional, nginx crashes if it does not find web. It checks hostname in the startup phase.
        # Fix this: https://sandro-keil.de/blog/2017/07/24/let-nginx-start-if-upstream-host-is-unavailable-or-down/
      logging: &logging
        driver: "json-file"
        options:
          # Rotate the files when they reach max-size.
          max-size: "200k"
          max-file: "10"
      restart: always
    web:
      command: uwsgi --ini /app/uwsgi.ini
      environment:
        - QUIZ_ENV=production
      logging:
        <<: *logging
      restart: always
    db:
      logging:
        <<: *logging
      restart: always
      volumes:
        - /quizdata:/var/lib/postgresql/data
```

Notes:

* The `json-file` driver is the default. You could use another plugin to write logs directly to aws cloudwatch or send them to some GELF endpoint. 
[Here](http://jpetazzo.github.io/2017/01/20/docker-logging-gelf/)'s an article on this from a great blog.
* In docker-compose `version: '3'` (that we are using), there's also a `restart_policy` setting.  
`restart_policy` is the only one taken into account when deploying in swarm mode.  
I feel it's clearer to use `restart` since we are not using swarm.
* I included some yaml goodness with the logging [anchor](https://learnxinyminutes.com/docs/yaml/) to avoid triplicating our config.


# Deploying with docker-machine

[docker-machine](https://docs.docker.com/machine/) is probably the simplest option for a simple, single-machine deployment.  

Sorry, there's some administrative work to do here. Requirements:

1. An [installation](https://docs.docker.com/machine/install-machine/) of `docker-machine`. 
I recommend installing the bash completion and prompt as well. 
2. An aws/google cloud/digital ocean account with programmatic access configured on your machine. Or your own server (use the [generic driver](https://docs.docker.com/machine/drivers/generic/)).

Creating an instance:

    docker-machine create --driver amazonec2 --amazonec2-open-port 80 aws-sandbox  
    
You can swap the driver for your favorite cloud provider.  
Here docker-machine will provision an ubuntu ec2 instance for us, install docker on it and make sure port 80 traffic is allowed in the AWS security group.  

Then we run:

    eval $(docker-machine env aws-sandbox)
    
and from now on (in our current shell), all docker commands we run will **point to the ec2 instance**.  

    # build still works as if you ran it locally, but the images are created on the remote instance.
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml build    
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    
That's it, our app is running in production!
    
<div class="ld-tech-details">
{% capture text %}
Some additional useful commands to work with docker-machine:

    docker-machine ip aws-sandbox
    docker-machine ssh aws-sandbox
    # Deactivate the docker-machine environment
    eval $(docker-machine env -u)

{% endcapture %}
{{ text | markdownify }}
</div>


# Conclusion

Once everything is in place it takes less than two minutes to get a new version of the app live (on an incremental build, not on first deployment).

<!-- An alternative to `docker-machine` would be to use a docker registry (a place to store your images, like AWS ECR provides) and to push images -->

That's it! 
Check out the [code on github](https://github.com/ldirer/deploy-app-docker/) and features an [amazing single-page application](http://quiz.wat.ldirer.com) deployed 
using this setup.


[^0]: Here we will use docker-machine so things are a bit different and we won't be pushing images through the network.  
