# Use Node.js 18 as base image
FROM node:18-slim

# Install dependencies required for Stockfish
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Clone and build Stockfish from source
# Use x86-64 architecture which will work on Google Cloud Run
RUN git clone https://github.com/official-stockfish/Stockfish.git && \
    cd Stockfish/src && \
    make -j build ARCH=x86-64-avx2 && \
    cp stockfish /usr/local/bin/

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install

# Copy all application files
COPY . ./

# Create cache directories
RUN mkdir -p tmp-cache analysis-cache openings-cache

# Expose the port the app runs on
EXPOSE 8080

# Command to run the application
CMD [ "node", "server.js" ]