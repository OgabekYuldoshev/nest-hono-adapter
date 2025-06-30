import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HonoAdapter } from './adapter';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, new HonoAdapter());
  await app.listen(process.env.PORT ?? 3000, () => {
    console.log('Hono server is running!');
  });
}
bootstrap();
