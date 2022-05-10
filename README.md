# eve-chainkills
Listener to zkill websocket for kills of interest in wormhole chain

1. [Installation](#installation)

## Installation

**Prerequisites**:
* [docker](https://docs.docker.com/)
* [docker-compose](https://docs.docker.com/)

> **Note**: The Docker-compose file uses Compose v3.8, so requires Docker Engine 19.03.0+

</br>
  
1. **Clone the repo**
    ```shell
    git clone --recurse-submodules  https://github.com/commando29/eve-chainkills.git/
    ```
    
> The `PROJECT_ROOT` key is the *absolute* path to the project directory, ie if you have clone it to /app/pathfinder-containers, this is the value you should enter. If you're unsure of the absolute path, you can use the command `pwd` to get the full absolute path of the current directory.

1. **Edit the *config.json

    
1. **Build & Run it**
    ```shell
    docker-compose up -d --build
    ```
