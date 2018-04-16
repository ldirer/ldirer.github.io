---
layout: mysingle
title: "Deploy your app with docker and docker-compose - Annex"
permalink: /deploy-docker-app/annex-docker/
is_annex: true
---

# Why use Docker

* You can easily share the environment with your team.
* You don't have to install complicated software on your machine.
* Your entire setup is specified in a human-readable yaml syntax.
* All the work you put in your development environment can be reused for production.
* You can run your production setup locally (for small projects). Then deploy using the **exact same images** on your remote server.

<!-- A new developer on a team should be able to download the repository, run `docker-compose up` and open his browser to see the application running.   -->
<!-- footnote modulo database migrations and the likes. -->

# Vocabulary

This section is for those who are not very clear on the distinction between docker images and containers.    
I did not find definitions very enlightening, so instead here are some statements that should make sense to you.  
They are a bit repetitive as they express only a couple ideas in different ways.  

* A docker container is a runtime instance of an image.  
* You can run several containers based on a single image at the same time.
* If you're familiar with object-oriented programming, you can think of an image as a class and of a container as an object.
* `docker build` creates an image, not a container.
* `docker run` creates and runs a container based on an image.
* `docker push` pushes an image to a remote repository called a **docker registry**.   
Typically dockerhub, but you can push to your own registry or to a cloud provider if you don't want your images to be public.
* When you make modifications to a container, it does not affect the image (and so future containers will not have your modifications). 
Here's a great explanation on the difference between containers and images [on stackoverflow](https://stackoverflow.com/a/23667302/3914041).
* When deploying, we don't have to go and `git pull` on our server. Pulling the relevant images and running them should be enough. Typically we need only our `docker-compose` files on the server.

