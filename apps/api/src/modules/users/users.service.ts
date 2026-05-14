import { Injectable } from '@nestjs/common';
import { LoggerContext } from 'src/core/logger/logger/logger.context';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CreateUserDto } from 'src/modules/users/dto/create-user.dto';

export interface User {
  id: number;
  name: string;
  email: string;
}

@Injectable()
export class UsersService {
  private users: User[] = [];
  private idCounter = 1;
  private readonly log: LoggerService;

  constructor(
    private readonly logger: LoggerService,
    private readonly ctx: LoggerContext,
  ) {
    this.log = this.logger.setContext(UsersService.name);
  }
  findAll(): User[] {
    this.log.info('Fetching all users', { count: this.users.length });
    this.log.error('This is an error log example', {
      exampleField: 'exampleValue',
    });
    throw new Error('Example error to demonstrate logging');

    return this.users;
  }

  create(createUserDto: CreateUserDto): User {
    const newUser: User = {
      id: this.idCounter++,
      ...createUserDto,
    };

    this.users.push(newUser);
    this.log.info('User created', { id: newUser.id });
    return newUser;
  }

  findUserById(id: number): User | undefined {
    this.ctx.set('userId', String(id));
    this.log.info('Finding user by ID', { id });

    return this.users.find((user) => user.id === id);
  }
}
