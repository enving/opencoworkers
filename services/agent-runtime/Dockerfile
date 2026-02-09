FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y \
    curl \
    git \
    procps \
    ca-certificates \
    python3 \
    python3-pip \
    && pip3 install --no-cache-dir --break-system-packages python-pptx openpyxl \
    && rm -rf /var/lib/apt/lists/*

# Install OpenCode
RUN curl -fsSL https://opencode.ai/install | bash -s -- --no-modify-path && \
    (mv /root/.agent-config /opt/opencode || mv /root/.opencode /opt/opencode || true) && \
    chmod -R 755 /opt/opencode || true && \
    ln -s /opt/opencode/bin/opencode /usr/local/bin/opencode || ln -s /root/.opencode/bin/opencode /usr/local/bin/opencode || ln -s /root/.agent-config/bin/opencode /usr/local/bin/opencode || true

WORKDIR /workspace

EXPOSE 4096

# We use the port 4096 as discussed
CMD ["opencode", "serve", "--port", "4096", "--hostname", "0.0.0.0"]
