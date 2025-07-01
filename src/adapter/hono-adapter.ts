/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as https from 'https';
import * as http from 'http';

import { AbstractHttpAdapter } from '@nestjs/core';
import {
  createAdaptorServer,
  HttpBindings,
  ServerType,
} from '@hono/node-server';
import { Context, Hono, HonoRequest } from 'hono';
import { Logger, NestApplicationOptions, StreamableFile } from '@nestjs/common';
import { StatusCode } from 'hono/utils/http-status';
export class HonoAdapter extends AbstractHttpAdapter<
  ServerType,
  HonoRequest,
  Context
> {
  private logger = new Logger(Hono.name);
  protected readonly instance?: Hono<{ Bindings: HttpBindings }> = new Hono();

  constructor(instance?: Hono<{ Bindings: HttpBindings }>) {
    super(instance);
  }

  initHttpServer(options: NestApplicationOptions) {
    const server = createAdaptorServer({
      fetch: this.instance?.fetch.bind(this.instance),
      createServer: options.httpsOptions
        ? https.createServer
        : http.createServer,
      overrideGlobalObjects: true,
    });

    this.setHttpServer(server);
  }

  public async close(): Promise<void> {
    if (this.httpServer) {
      return new Promise((resolve, reject) => {
        this.httpServer.close((err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  }

  public listen(port: string | number, callback?: () => void): void;
  public listen(
    port: string | number,
    hostname: string,
    callback?: () => void,
  ): void;
  public listen(
    port: string | number,
    hostnameOrCallback?: string | (() => void),
    callback?: () => void,
  ): void {
    const portNumber = typeof port === 'string' ? parseInt(port, 10) : port;
    let hostname: string | undefined;
    let cb: (() => void) | undefined;

    if (typeof hostnameOrCallback === 'string') {
      hostname = hostnameOrCallback;
      cb = callback;
    } else {
      cb = hostnameOrCallback;
    }

    this.httpServer.listen(portNumber, hostname, () => {
      if (cb) {
        cb();
      }
    });
  }

  useStaticAssets() {}
  setViewEngine() {
    this.logger.warn('setViewEngine is not implemented');
  }
  getRequestHostname(request: Context) {
    return new URL(request.req.url).hostname;
  }
  getRequestMethod(request: Context) {
    return request.req.method;
  }
  getRequestUrl(request: Context) {
    return request.req.url;
  }
  public status(response: Context, status: StatusCode) {
    response.status(status);
  }
  reply(response: Context, body: any, status?: StatusCode) {
    if (status) {
      response.status(status);
    }

    if (body instanceof StreamableFile) {
      const streamHeaders = body.getHeaders();
      if (streamHeaders.type) {
        response.header('Content-Type', streamHeaders.type);
      }

      if (streamHeaders.disposition) {
        response.header(
          'Content-Disposition' as any,
          streamHeaders.disposition as any,
        );
      }

      if (streamHeaders.length) {
        response.header('Content-Length', streamHeaders.length.toString());
      }

      const stream = body.getStream();

      response.res = response.body(stream as any);

      return;
    }

    if (typeof body === 'string') {
      response.res = response.text(body);
      return;
    }

    if (typeof body === 'object') {
      response.res = response.json(body);
      return;
    }

    response.res = response.body(body);
  }
  end() {}
  render() {
    this.logger.warn('render is not implemented');
  }
  redirect() {}
  setErrorHandler() {}
  setNotFoundHandler() {}
  isHeadersSent() {}
  getHeader() {}
  setHeader() {}
  appendHeader() {}
  registerParserMiddleware(prefix?: string, rawBody?: boolean) {
    console.log(prefix, rawBody);
  }
  enableCors() {}
  createMiddlewareFactory() {
    return (() => {}) as any;
  }
  getType(): string {
    return 'hono';
  }
  applyVersionFilter() {
    return (() => {}) as any;
  }
  private registerRoutes(method: string, ...args: any[]) {
    const path = this.normalizePath(String(args[0]));
    const handler = args[args.length - 1];

    const honoHandler = (c: Context) => handler(c.req, c);

    switch (method.toUpperCase()) {
      case 'GET':
        return this.instance?.get(path, honoHandler);
      case 'POST':
        return this.instance?.post(path, honoHandler);
      case 'PUT':
        return this.instance?.put(path, honoHandler);
      case 'DELETE':
        return this.instance?.delete(path, honoHandler);
      case 'PATCH':
        return this.instance?.patch(path, honoHandler);
      case 'OPTIONS':
        return this.instance?.options(path, honoHandler);
      case 'ALL':
        return this.instance?.all(path, honoHandler);
      default:
        return this.instance?.on(method as any, path, honoHandler);
    }
  }

  public normalizePath(path: string): string {
    if (!path || path === '') {
      return '/';
    }

    if (!path.startsWith('/')) {
      path = '/' + path;
    }

    path = path.replace(/\*$/, '*');

    path = path.replace(/\?/g, '?');

    return path;
  }

  public get(...args: any[]) {
    return this.registerRoutes('GET', ...args);
  }

  public post(...args: any[]) {
    return this.registerRoutes('POST', ...args);
  }

  public head(...args: any[]) {
    return this.registerRoutes('HEAD', ...args);
  }

  public delete(...args: any[]) {
    return this.registerRoutes('DELETE', ...args);
  }

  public put(...args: any[]) {
    return this.registerRoutes('PUT', ...args);
  }

  public patch(...args: any[]) {
    return this.registerRoutes('PATCH', ...args);
  }

  public options(...args: any[]) {
    return this.registerRoutes('OPTIONS', ...args);
  }

  public search(...args: any[]) {
    return this.registerRoutes('SEARCH', ...args);
  }

  public propfind(...args: any[]) {
    return this.registerRoutes('PROPFIND', ...args);
  }

  public proppatch(...args: any[]) {
    return this.registerRoutes('PROPPATCH', ...args);
  }

  public mkcol(...args: any[]) {
    return this.registerRoutes('MKCOL', ...args);
  }

  public copy(...args: any[]) {
    return this.registerRoutes('COPY', ...args);
  }

  public move(...args: any[]) {
    return this.registerRoutes('MOVE', ...args);
  }

  public lock(...args: any[]) {
    return this.registerRoutes('LOCK', ...args);
  }

  public unlock(...args: any[]) {
    return this.registerRoutes('UNLOCK', ...args);
  }
}
