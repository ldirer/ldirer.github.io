---
layout: mysingle
title: "Deploy your app with docker and docker-compose - Development environment"
permalink: /deploy-docker-app/
---

In order to deploy an application using docker, the first step is to set up a development environment.

This tutorial will walk you through creating a dockerized development environment for a single page application.   

* The examples will use a Vuejs frontend and a Python backend, but the code is kept to a minimum so we can focus on the docker setup.  
* The concepts are language/framework-agnostic, they should be useful for somebody deploying a Golang + React application.
* Although we will start from scratch, you should be able to adapt this to an existing application.

Target audience:

* Developers that want to understand their `docker-compose` setup better or improve it.
* Developers that want to deploy an existing application using docker.
* Teams that want to standardize their development environment (without necessarily going to production with it).

Requirements:

* You should have `docker` and `docker-compose` installed on your machine.
* You should be comfortable running commands in your terminal.
<!-- * TODO: Fill that with feedback from The People. -->

# Overview

We will develop a simple application with a Python Flask backend, a Postgresql database and a Vuejs frontend. 
We will start by looking at each part individually, then see how we can connect them together.

All our code will run in containers. Most of the time you should be able to forget that your code is running in a container and not locally.    

The objective is simple: have a development setup that is roughly as efficient (or more) than installing everything on your machine.

This environment will be **easily shareable** with your potential teammates and we will be able to reuse some of our work to **make deploying our application much easier**.

<!--
When working on your machine you typically have to deal with:

* Setting up the database(s) and tooling (could mean installing/upgrading postgres, redis, rabbitmq...)
* Installing libraries for your backend (if using Python, probably in a virtual environment to avoid conflicts with other projects)

Once you're setup things usually run smoothly if you are a solo developer. 
Then you want to deploy your app and you basically have to start from scratch on a remote server (possibly a different operating system), with all the risks and difficulties involved.
-->

# Backend

Let's start with the simplest Flask application.

<p class="ld-code-filename"><code>app.py</code></p>
```python
from flask import Flask

app = Flask(__name__)   

app.config['DEBUG'] = True

@app.route('/')
def hello_docker():
    return 'Soon this will all run from docker.'

if __name__ == '__main__':
    app.run()
```

`app.config['DEBUG'] = True` makes the development server reload files when we change our code. 
 
<p class="ld-code-filename"><code>requirements.txt</code></p>
```
Flask
```

We want to run this from docker. We need to create a docker image that can do this.  
Let's create a `web.dockerfile`:

```dockerfile
FROM python:3.6

RUN mkdir /app
WORKDIR /app

ADD requirements.txt ./

RUN pip install -r requirements.txt

ADD ./ ./

CMD python app.py
```

<div class="ld-tech-details">
{% capture text %}
This is as simple as a dockerfile gets. If you're not familiar with it here's what we are doing:

* Start from an [image containing python3.6](https://hub.docker.com/_/python/)
* Create a directory for our code, move to it. 
* Copy (`ADD`) our requirements file and install all libraries (only Flask but there could be more!).
* Copy all our code into the image.
* Specify a default command to run when launching a container: here we launch our flask application.
{% endcapture %}
{{ text | markdownify }}
</div>


To build the image from this dockerfile we run the following command:

    docker build -f web.dockerfile -t docker-tutorial/web ./

<div class="ld-tech-details">
{% capture text %}
`-f` specifies the dockerfile to use, `-t` what tag (think name) to give to the image and the last argument is *the build context*.   
The build context is basically the set of files that is passed to docker when building. 
You can think about it as the 'current host directory' in the dockerfile.

    # Here docker is copying {BUILD_CONTEXT_DIRECTORY}/requirements.txt to the image.
    ADD requirements.txt /some-directory-on-the-image
{% endcapture %}

{{ text | markdownify }}
</div>

We can then run a container based on the image we just built:

    docker run --rm -it docker-tutorial/web 

At this stage it should display:

    $ docker run --rm -it docker-tutorial/web             
    * Running on http://127.0.0.1:5000/ (Press CTRL+C to quit)


<div class="ld-tech-details">
{% capture text %}
`-it` is there so that our container can be stopped using `CTRL+C/CMD+C`.  
`--rm` means we want our container to be removed when it stops.
{% endcapture %}
{{ text | markdownify }}
</div>

Great. However if you open up your browser you'll notice **it does not work**.  
This is because Flask is running on port 5000 *on the container* which is not the same as port 5000 on *the host* (which is your machine if you are on linux, and a virtual machine created by docker if you are on Mac OS or Windows). 

We need to map our host port to the container port so we can access it:

    $ docker run -p 5000:5000 -t docker-tutorial/web             
    * Running on http://127.0.0.1:5000/ (Press CTRL+C to quit)

At this stage... it still does not work!   
The ports are linked properly but the flask server only listens to requests coming from the container (it is running on `127.0.0.1` *on the container*).
This is a common gotcha, here's how we fix it:

    if __name__ == '__main__':
        app.run('0.0.0.0')

`0.0.0.0` tells our server to listen to requests from any origin on the network, so we can reach the container from our host.

Now we can open `http://127.0.0.1:5000/` in the browser and it works!


However if you try changing `app.py` to return a different message, you will see that changes are not taken into account.  
With this setup you need to build the image again so that the container has the new `app.py` file.  
Of course we don't want to build the image again every time we write new code. We can use a **volume** to synchronize a directory on our machine with a directory on the container:

    
    $ docker run --rm -v $(pwd):/app -p 5000:5000 -it docker-tutorial/web             

<div class="ld-tech-details">
{% capture text %}
`-v` stands for volume. We use bash command substitution to map the current directory to `/app`.  
This is basically `-v ./:/app` except that docker requires an absolute path.  
We map to the same directory (`/app`) we copied the code to at build time.
{% endcapture %}
{{ text | markdownify }}
</div>


Our image already had our code in `/app` because we copied it there at build time. 
The volume overwrites it and allows us to edit code on our machine and to have the changes reflected in the container.  

At this point you might wonder why we copied the code into the image during the `build`.  
This is because the volume is only for development purposes and we will want to use the same image for production.

# Adding a database

A web app usually requires a database. 
I feel it's actually easier to setup your database using docker than to install it on your machine (beit postgres, mongo or whatever you pick).

    docker run --rm --name db -p 5432:5432 postgres:10.2

<div class="ld-tech-details">
{% capture text %}
You can start adding the `-d` flag to the `docker run` commands if you want the processes to run in background.   
5432 is postgres default port.
We name our container so we can reference it in docker commands later on if required.
{% endcapture %}
{{ text | markdownify }}
</div>

That's it. Now we have a postgres server running in the container and bound to our host port 5432.   
In this tutorial we won't detail the code that talks with the database as this is Python-specific and unrelated to docker. 
<!-- TODO: WELL MOSTLY >> POSTGRES URL?  
TODO: github example should contain code that does that.
-->


We could run our docker commands one at a time every time we want to run our app, but it is a bit tedious when these commands get long or we add more containers.  

Enter docker-compose.  
At the basic level docker-compose is just a tool that lets us to store all our docker commands in a single configuration file and have them run all at once if we want to [^1].  

<p class="ld-code-filename"><code>docker-compose.yml</code></p>
```yaml
version: '3'
services:
    web:
      image: docker-tutorial/web
      build:
        context: ./
        dockerfile: web.dockerfile
      ports:
        - "5000:5000"
      volumes:
        - ./:/app
      depends_on:
        - db 
    db:
      image: postgres:10.2-alpine
      environment:
          - POSTGRES_USER=postgres
          - POSTGRES_PASSWORD=postgres
      ports:
          - "5432:5432"
```

You can now use `docker-compose build` to build your images (right now we only have one custom image, for `web`).

And you can launch both the backend and the database with:

    docker-compose up
    
<div class="ld-tech-details">
{% capture text %}
You can also use the `build` and `up` commands with service names as arguments, to launch only these services.  
This will launch only our database:

    docker-compose up db
    
{% endcapture %}
{{ text | markdownify }}
</div>
Looking at the `docker-compose.yml` file, each of the `services` sections defines:
 
* How to build the image for that service.
* What parameters to pass to docker when launching the container for that service.
* Some extra parameters like `depends_on` ([docs](https://docs.docker.com/compose/compose-file/#depends_on)).  
Optional here, makes sure that if you `docker-compose up web` it launches the database as well.

You will recognize some of the parameters we used in our `docker run` commands: `ports` and `volumes`.  
Note the `db` service does not provide a `build` section because it uses an [image from dockerhub](https://hub.docker.com/r/library/postgres/).

<div class="ld-tech-details">
{% capture text %}
For our use case, `docker-compose` means we will only run one container of each service at a time.  
This is not an effective limitation since we will run our app on a single machine.  
To run multiple containers (on different machines!) for a single service you would need `docker-swarm` (which conveniently also makes use of the `docker-compose.yml` file!).  
This is objectively more 'devops' complexity though, and is not usually required until your project really starts to grow.
{% endcapture %}
{{ text | markdownify }}
</div>


# Adding a frontend

We mentioned a single page application so we need a frontend.  
Though we could use vanilla JavaScript for the purpose of this tutorial, we will use Vue.js because most people start with a framework.

We will also use a docker container to run our frontend development server.  
This means we don't have to install `npm` on our host machine and everybody in our team has the same version of node.  

    mkdir client
    
Let's create our `front.dockerfile`:

```
FROM node:9.5

# Specify the version so builds are (more) reproducible.
RUN npm install --quiet --global vue-cli@2.9.3

RUN mkdir /app
WORKDIR /app
```

Add a new service to our `docker-compose.yml` file:

```yaml
front:
  image: docker-tutorial/front
  build:
    context: ./
    dockerfile: front.dockerfile
  volumes:
    - ./client:/app
  ports:
    - "8080:8080"
```

This should start to look familiar. 
* We bind port 8080 on our machine with port 8080 on our container (8080 because it is the default port that our `webpack-dev-server` will use).
* We use a volume to sync our code between the container and the `client/` folder.

You might have noticed that the `front.dockerfile` is *very simple*.   
Basically we use it only to get `npm`. All the packages will be installed on the container. 
Thanks to the volume everything will happen as if we had installed them locally [^2].   



Now we will use `vue-cli` to bootstrap our client code. We need to run this in our container since this is where `vue-cli` is installed.

    # This will give us boilerplate code for a Vue application with a full-blown build process.
    # See https://github.com/vuejs-templates/webpack for the template we are using
    docker-compose run --rm front vue init webpack
    
When you run this for the first time, `docker-compose` wants to launch a container based on the `docker-tutorial/front` image.  
This image does not exist yet because we have not built it: `docker-compose` realizes that and builds the image.
Then it can launch our container and run the command we passed it: `vue init webpack`.

    # You will get a number of questions. Remember this runs on the container.
    $ docker-compose run --rm front vue init webpack
    ? Generate project in current directory? (Y/n) Y
    
For this tutorial I chose to not use vue-router, eslint and opted out of the tests.  
I accepted the option to run `npm install` after the project has been created.  

This will install all required javascript packages on the container in a `node_modules` directory. 
Since we are using a volume we will see these files appear in our host `client/node_modules` directory.

The `vue` command line also created a lot of files for us to bootstrap our app.

We can now run:

    docker-compose run --rm --service-ports front npm run dev
    
<div class="ld-tech-details">
{% capture text %}
The `--service-ports` flag makes sure that ports are bound as specified in the `docker-compose.yml` file.  
This is not the default for `docker-compose run` (as opposed to `docker-compose up`), probably so you can `run` stuff 
even when you are running `up` without getting a port conflict. 
{% endcapture %}

{{ text | markdownify }}
</div>
<!-- TODO: That's really just a random guess.  -->


    
This should launch a server running on `localhost:8080` on the container. However this is not enough so we can access it from the host!
Same thing as with the backend, we need to serve on `0.0.0.0:80` in the container. We can change the webpack config to do this.  
In `client/config/index.js` under the dev section change `host: 'localhost'` to `host: '0.0.0.0'`.

<div class="ld-tech-details">
{% capture text %}
Caveat: If you're running OS X or Windows, everything should be smooth.  
If you're running Linux here you will see that the files under `client/` are all owned by root (which means you need to sudo to edit them, which is annoying).
It is a little bit tricky to get proper permissions. This command works:

    docker-compose run --rm front bash -c "vue init webpack && chown -R $(id -u):$(id -g) ./"
    
Breakdown of the command: 

* We use `bash -c ".."` because we need to run two commands. 
Without this the command after `&&` is interpreted as another command to run *on your machine*.
* We make use of bash command substitution: `$(id -u)` and `$(id -g)` are evaluated **before the command runs**, so they contain your user and group id. 

Final note: if you ran the Mac/Windows command and want to `sudo rm -rf client/`, it's safer to do it on the container!   

    docker-compose run --rm front bash -c "rm -rf /app/"
{% endcapture %}

{{ text | markdownify }}
</div>

 
Finally this will let us access our frontend in the browser:

    docker-compose run --rm --service-ports front npm run dev
    
Visiting `http://localhost:8080/` you should see a warm `Welcome to Your Vue.js App`.
    

Let's add this command to our compose file so `docker-compose up` uses it:

      command: npm run dev
      volumes:
        - ./client:/app
      ports:
        - "8080:8080"
        
        
Great! Now running `docker-compose up` launches our frontend, backend and database servers.


If you have an existing application you can change the dockerfile to remove the `vue-cli` installation.  
For consistency between developers you should use `npm` from the frontend container to install packages rather than 
your local version.


# Putting things together

Now we want to connect our backend with our frontend.  

We'd like to write code like:

```javascript
fetch('http://localhost:5000/api')    // Whether we'd really like to use `fetch` is a separate matter.
  .then(...)
```

However this is not going to work due to Cross-Origin Resource Sharing ([CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)) restrictions.  
This happens because we make a request on `localhost:5000` from another origin `localhost:8080`, to which our server answers "I don't know you; I'm not answering.".

CORS is only an issue in development, because we will not be using `webpack-dev-server` in production.  

There are several ways of fixing it, we will use webpack proxying feature to get around it.

The changes we have to make are in the webpack config again:

In `index.js`
<p class="ld-code-filename"><code>client/config/index.js</code></p>
```javascript
proxyTable: {
    '/api': {
      target: 'http://web:5000',
      changeOrigin: true
    }
},
```

Note hot-reloading does not work for webpack config files so you need to stop and re-run `docker-compose up` so changes take effect [^3].

From `http://localhost:8080` we will make a request to `http://localhost:8080/api` instead of `http://localhost:5000/api` and it is `webpack-dev-server` that will transmit it to the backend.  
In this process our webpack development server will change the origin header so our request is accepted. 
<!-- TODO: I don't really understand why webpack is able to do this. Ask zulip! -->

Now why are we using `web:5000` and not `localhost:5000`?  

Remember it will be `webpack-dev-server` relaying the request to our web container: the request won't originate from your host but from the frontend container.  
That means if you use `target: 'http://localhost:5000'`, requests will be made to the port 5000 on the frontend container, and there's nothing there!

But why does `web:5000` even work?

This is `docker-compose` magic: **it created a docker network with all our containers**. 
Our containers can talk to each other using the service names as addresses.
<!-- TODO: that's important. Highlight somehow? Mb also check wording is *precise*.
TODO: mention this is 12-factor stuff? See jerome Petazonni smt talk. -->


You can test this configuration by adding this bit of JS to your `client/index.html` file:

<p class="ld-code-filename"><code>client/index.html</code></p>
```html
<script type="text/javascript">
  fetch('/api').then(res => res.text())   
              .then(text => console.log('text', text))
</script>
```

Note we also need to make sure we have an `api/` route on our flask server, so change the url in `app.py`:

<p class="ld-code-filename"><code>app.py</code></p>
```python
@app.route('/api')
def hello_docker():
    return 'Now this really runs from docker!'
```

If you open your browser with the devtools and refresh the page, you should see the message logged in the console!

<div class="ld-tech-details">
{% capture text %}
Here are some other ways of fixing CORS. I consider both to be lesser solutions in 2018, I don't know of any advantage they provide over proxying:

1. You could change your backend code to *allow cross origin requests*. This should **never happen in production**.  
In Flask you could use the `flask-cors` extension to achieve that with minimal overhead.  

2. You could make your backend server serve your `index.html` file and include the relevant javascript bundles (that would still be served by the webpack server so you still have hot reloading and co).   
With this setup you access your app on `http://localhost:5000`. The CORS restrictions don't apply because requests to your api come from the same origin.
{% endcapture %}
{{ text | markdownify }}
</div>



# Tips for developing with docker-compose

Though this setup is a good start, you will have to learn about docker along the way. This can usually be done progressively though.  
Here are some tips for day-to-day work:

* `docker-compose up` does not play well with standard input: that means you can't use `pdb` if you start your backend server with docker-compose up.

I usually `docker-compose up front db ... [-d]` to launch all the containers but my backend server.  
Then I do `docker-compose run --rm --name web --service-ports web` as this works with `pdb`.

* It's nice to explicitly name your containers when using `docker-compose run`, as it makes it easier to run ad-hoc docker commands you might need.  
Otherwise you need to lookup the random-generated name that docker gave your container.

* Sometimes you need/want to go look on your container what the hell is going on.

    ```bash
    # web here needs to be the name of a running container. 
    # It does not refer to the service, docker does not even know about the compose file.
    docker exec -it web bash
    ```
    
    `-it` makes sure you get a terminal prompt so you can explore things. Otherwise docker just runs bash and exits.
    (`--tty`: give me a prompt! ;`--interactive`: keep stdin attached so I can use that prompt!)
    
# Conclusion and next steps

We have a development environment that runs completely inside docker. Great!
This is already a big win if you are working with a team and you need a consistent development environment.

Also note that you don't have to do all of this at once.   

I would argue using docker-compose only for things like your database, `redis` or `rabbit-mq` is already a win, since it's faster and easier than installing them on your machine.  
<!-- If you have a complex app and want to start by using docker only for the database and the backend, that's already great.  -->
On some projects I do not dockerize my frontend development server and just run it on my machine. 
I feel there are less benefits to dockerizing the frontend than the backend, since we won't really reuse the frontend part for deployment.


The next big win is **ease of deployment**. Though we will have to make some changes ;).

The goal of the next tutorial will be to get a production setup that:

* Does not duplicate everything we've done so far.
* Can be tested locally so you can fight with that nginx configuration on your ground.
* Can be deployed efficiently - in terms of both speed and developer input.
* Includes logging, restart policies and other niceties.
* Makes you feel good if you've ever struggled with a deployment process.

[^1]: There's a bit more to it than that, `docker-compose` also lets our containers talk to each other as we will see later on.   
[^2]: We are doing this so that we don't have to worry about installing node and npm, or different versions between developers.
[^3]: You could also run `docker-compose down frontend` and `docker-compose up frontend` to restart just this service.

