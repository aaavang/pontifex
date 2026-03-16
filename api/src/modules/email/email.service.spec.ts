import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: (...args: any[]) => mockSendMail(...args),
  }),
}));

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
              const config = {
                PONTIFEX_SMTP_HOST: 'localhost',
                PONTIFEX_SMTP_PORT: 1025,
                PONTIFEX_SMTP_FROM: 'pontifex@test.com',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(EmailService);
    service.onModuleInit();
  });

  describe('send', () => {
    it('should send an email with the correct parameters', async () => {
      await service.send({
        to: 'user@test.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      });

      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'pontifex@test.com',
        to: 'user@test.com',
        subject: 'Test Subject',
        text: undefined,
        html: '<p>Hello</p>',
      });
    });

    it('should join multiple recipients', async () => {
      await service.send({
        to: ['a@test.com', 'b@test.com'],
        subject: 'Multi',
        text: 'hi',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'a@test.com, b@test.com' }),
      );
    });

    it('should not throw if sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP down'));

      await expect(
        service.send({ to: 'x@test.com', subject: 'fail', text: 'hi' }),
      ).resolves.not.toThrow();
    });
  });
});
