/* eslint-disable @typescript-eslint/prefer-promise-reject-errors */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-function-type */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import * as http from 'node:http';
import * as https from 'node:https';

import { AbstractHttpAdapter } from '@nestjs/core';
import { Hono, HonoRequest, Context } from 'hono';
import { cors } from 'hono/cors';
import { isUndefined } from '@nestjs/common/utils/shared.utils';
import {
  createAdaptorServer,
  ServerType,
  HttpBindings,
} from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import {
  Logger,
  NestApplicationOptions,
  StreamableFile,
  VersioningOptions,
  VersioningType,
} from '@nestjs/common';
import {
  UriVersioningOptions,
  VERSION_NEUTRAL,
  VersionValue,
} from '@nestjs/common/interfaces';
import { RedirectStatusCode, StatusCode } from 'hono/utils/http-status';

type VersionedRoute<TRequest, TResponse> = ((
  req: TRequest,
  res: TResponse,
  next: Function,
) => Function) & {
  version: VersionValue;
  versioningOptions: VersioningOptions;
};

export class HonoAdapter extends AbstractHttpAdapter<
  ServerType,
  HonoRequest,
  Response
> {
  private logger = new Logger(Hono.name);
  private versioningOptions?: VersioningOptions;
  private _pathPrefix?: string;
  protected readonly instance?: Hono<{ Bindings: HttpBindings }>;
  constructor(instance?: Hono<{ Bindings: HttpBindings }>) {
    super();
    const honoInstance = instance || new Hono<{ Bindings: HttpBindings }>();
    this.instance = honoInstance;
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
  public initHttpServer(options: NestApplicationOptions) {
    const server = createAdaptorServer({
      fetch: this.instance?.fetch.bind(this.instance),
      createServer: options.httpsOptions
        ? https.createServer
        : http.createServer,
      overrideGlobalObjects: true,
    });

    this.setHttpServer(server);
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

  public useStaticAssets(path: string, options?: any): any {
    const staticPath = options?.prefix || '/static';
    this.instance?.use(
      `${staticPath}/*`,
      serveStatic({
        root: path,
        ...options,
      }),
    );
  }
  public setViewEngine() {
    this.logger.warn(
      'View engine support needs to be implemented for specific template engines',
    );
  }
  public getRequestHostname(request: HonoRequest) {
    return new URL(request.raw.url).hostname;
  }
  public getRequestMethod(request: HonoRequest) {
    return request.raw.method;
  }
  public getRequestUrl(request: HonoRequest) {
    return request.raw.url;
  }
  public status(response: Context, statusCode: StatusCode) {
    return response.status(statusCode);
  }
  public reply(response: Context, body: any, statusCode?: StatusCode): any {
    if (statusCode) {
      response?.status(statusCode);
    }
    if (body instanceof StreamableFile) {
      const streamHeaders = body.getHeaders();

      if (streamHeaders.type) {
        response.header('Content-Type', streamHeaders.type);
      }
      //   if (streamHeaders.disposition) {
      //     response.header('Content-Disposition', streamHeaders.disposition);
      //   }
      if (streamHeaders.length) {
        response.header('Content-Length', streamHeaders.length.toString());
      }

      return response.body(body.getStream() as any);
    }
    if (body) {
      if (typeof body === 'string') {
        return response.text(body);
      }

      if (typeof body === 'object') {
        return response.json(body);
      }
      return response.body(body);
    }
  }

  public end(response: Context, message?: string) {
    if (message) {
      return response.text(message);
    }
  }
  public render() {
    this.logger.warn(
      'Render method needs to be implemented with a template engine',
    );
  }
  public redirect(
    response: Context,
    statusCode: RedirectStatusCode,
    url: string,
  ) {
    return response.redirect(url, statusCode);
  }
  public setErrorHandler(handler: Function) {
    this.instance?.onError((err, c) => {
      return handler(err, c.req, c);
    });
  }
  public setNotFoundHandler(handler: Function) {
    this.instance?.notFound((c) => {
      return handler(c.req, c);
    });
  }
  public isHeadersSent() {
    return false;
  }
  public getHeader(response: Context, name: string) {
    return response.req.header(name);
  }
  public setHeader(response: Context, name: string, value: string) {
    return response.header(name, value);
  }
  public appendHeader(response: Context, name: string, value: string) {
    return response.header(name, value);
  }
  public registerParserMiddleware(prefix?: string): any {
    this._pathPrefix = prefix
      ? !prefix.startsWith('/')
        ? `/${prefix}`
        : prefix
      : undefined;
  }
  public enableCors(options?: any, prefix?: string) {
    const corsOptions = {
      origin: options?.origin || '*',
      credentials: options?.credentials || false,
      methods: options?.methods || ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: options?.allowedHeaders || [
        'Content-Type',
        'Authorization',
      ],
      ...options,
    };

    if (prefix) {
      this.instance?.use(`${prefix}/*`, cors(corsOptions));
    } else {
      this.instance?.use('*', cors(corsOptions));
    }
  }
  public createMiddlewareFactory() {
    return (path: string, callback: Function) => {
      this.instance?.use(path, async (c, next) => {
        const req = c.req;
        const res = c;
        return new Promise<void>((resolve, reject) => {
          callback(req, res, (err?: any) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        }).then(() => next());
      });
    };
  }
  public getType(): string {
    return 'hono';
  }
  public applyVersionFilter(
    handler: Function,
    version: VersionValue,
    versioningOptions: VersioningOptions,
  ): VersionedRoute<HonoRequest, Response> {
    if (!this.versioningOptions) {
      this.versioningOptions = versioningOptions;
    }

    const versionedRoute = handler as VersionedRoute<HonoRequest, Response>;
    versionedRoute.version = version;
    versionedRoute.versioningOptions = versioningOptions;

    return versionedRoute;
  }

  public get(...args: any[]): any {
    return this.registerRoute('GET', ...args);
  }

  public post(...args: any[]): any {
    return this.registerRoute('POST', ...args);
  }

  public put(...args: any[]): any {
    return this.registerRoute('PUT', ...args);
  }

  public delete(...args: any[]): any {
    return this.registerRoute('DELETE', ...args);
  }

  public patch(...args: any[]): any {
    return this.registerRoute('PATCH', ...args);
  }

  public head(...args: any[]): any {
    return this.registerRoute('HEAD', ...args);
  }

  public options(...args: any[]): any {
    return this.registerRoute('OPTIONS', ...args);
  }

  public all(...args: any[]): any {
    return this.registerRoute('ALL', ...args);
  }

  public propfind(...args: any[]): any {
    return this.registerRoute('PROPFIND', ...args);
  }

  public proppatch(...args: any[]): any {
    return this.registerRoute('PROPPATCH', ...args);
  }

  public mkcol(...args: any[]): any {
    return this.registerRoute('MKCOL', ...args);
  }

  public copy(...args: any[]): any {
    return this.registerRoute('COPY', ...args);
  }

  public move(...args: any[]): any {
    return this.registerRoute('MOVE', ...args);
  }

  public lock(...args: any[]): any {
    return this.registerRoute('LOCK', ...args);
  }

  public unlock(...args: any[]): any {
    return this.registerRoute('UNLOCK', ...args);
  }

  public search(...args: any[]): any {
    return this.registerRoute('SEARCH', ...args);
  }

  private shouldApplyVersioning(handler: any): boolean {
    return !isUndefined(handler.version) && handler.version !== VERSION_NEUTRAL;
  }

  private isVersionMatching(
    requestVersion: any,
    handlerVersion: VersionValue,
  ): boolean {
    if (!requestVersion) {
      return handlerVersion === VERSION_NEUTRAL;
    }

    if (Array.isArray(handlerVersion)) {
      return handlerVersion.includes(requestVersion);
    }

    return requestVersion === handlerVersion;
  }

  private extractVersion(request: HonoRequest) {
    if (!this.versioningOptions) {
      return undefined;
    }

    switch (this.versioningOptions.type) {
      case VersioningType.HEADER: {
        return request.header(this.versioningOptions.header) || VERSION_NEUTRAL;
      }
      case VersioningType.MEDIA_TYPE: {
        const acceptHeader = request.header('Accept') || '';
        const mediaTypeMatch = acceptHeader.match(
          new RegExp(`${this.versioningOptions.key}=([^;,\\s]+)`),
        );
        return mediaTypeMatch ? mediaTypeMatch[1] : VERSION_NEUTRAL;
      }
      case VersioningType.URI: {
        const url = new URL(request.url);
        const pathSegments = url.pathname.split('/');
        const versionIndex = pathSegments.findIndex((segment) =>
          segment.startsWith(
            (this.versioningOptions as UriVersioningOptions).prefix || 'v',
          ),
        );
        return versionIndex !== -1
          ? pathSegments[versionIndex]
          : VERSION_NEUTRAL;
      }
      case VersioningType.CUSTOM: {
        return (
          this.versioningOptions.extractor?.(request as any) || VERSION_NEUTRAL
        );
      }

      default: {
        return VERSION_NEUTRAL;
      }
    }
  }

  private registerRoute(method: string, ...args: any[]): any {
    const path = args[0];
    const handler = args[args.length - 1];

    const normalizedPath = this.normalizePath(path);

    const honoHandler = async (c: Context) => {
      const req = c.req;
      const res = c;

      if (this.shouldApplyVersioning(handler)) {
        const version = this.extractVersion(req);

        if (!this.isVersionMatching(version, handler.version)) {
          c.status(404);
          return c.text('Version not found');
        }
      }

      return await handler(req, res);
    };

    switch (method.toUpperCase()) {
      case 'GET':
        return this.instance?.get(normalizedPath, honoHandler);
      case 'POST':
        return this.instance?.post(normalizedPath, honoHandler);
      case 'PUT':
        return this.instance?.put(normalizedPath, honoHandler);
      case 'DELETE':
        return this.instance?.delete(normalizedPath, honoHandler);
      case 'PATCH':
        return this.instance?.patch(normalizedPath, honoHandler);
      case 'OPTIONS':
        return this.instance?.options(normalizedPath, honoHandler);
      case 'ALL':
        return this.instance?.all(normalizedPath, honoHandler);
      default:
        return this.instance?.on(method as any, normalizedPath, honoHandler);
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

    if (this._pathPrefix && !path.startsWith(this._pathPrefix)) {
      path = this._pathPrefix + path;
    }

    return path;
  }
}
