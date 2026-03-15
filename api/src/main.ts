import {BadRequestException, ValidationPipe} from "@nestjs/common";
import {NestFactory} from '@nestjs/core';
import {DocumentBuilder, SwaggerModule} from '@nestjs/swagger';
import {AppModule} from './app.module';
import 'reflect-metadata';

declare const module: any;

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.useGlobalPipes(new ValidationPipe({
                                              whitelist: true,  // strip unknown properties
                                              forbidNonWhitelisted: true, // throw if unknown props are sent
                                              transform: true,  // auto-convert types
                                              enableDebugMessages: true, // <-- enable extra logs (NestJS 9+)
                                              exceptionFactory: (errors) => {
                                                  console.error(JSON.stringify(errors, null, 2)); // <-- log full error details
                                                  return new BadRequestException(errors);
                                              }
                                          }));
    app.setGlobalPrefix('api')

    const config = new DocumentBuilder()
        .setTitle('Pontifex API')
        .setDescription('Management Layer that makes Azure Entra ID AWESOME!')
        .setVersion('1.0')
        .addTag('pontifex')
        .build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, documentFactory);
    await app.listen(process.env.PORT ?? 3001);

    if (module.hot) {
        module.hot.accept();
        module.hot.dispose(async () => await app.close());
    }
}

bootstrap();
