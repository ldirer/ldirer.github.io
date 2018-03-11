
# Deploying

1. Build with jekyll:

        # This creates the _site directory that we will copy into our docker image.
        bundle exec jekyll build
    
2. `eval $(docker-machine env aws-ldirer.com)`
3. `docker-compose build`
4. `docker-compose -f docker-compose.yml up -d`  
Explicitely pass the config file with `-f` so that `.override` is not loaded.

