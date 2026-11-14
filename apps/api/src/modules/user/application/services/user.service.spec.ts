import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { LoggerContext } from 'src/core/logger/logger/logger.context';
import { LoggerService } from 'src/core/logger/logger/logger.service';

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: LoggerService,
          useValue: {
            setContext: jest.fn().mockReturnThis(),
            info: jest.fn(),
          },
        },
        {
          provide: LoggerContext,
          useValue: {
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
