import { LoggerContext } from 'src/core/logger/logger/logger.context';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { CreateUserInput } from '../dto/create-user.input';
export interface User {
    id: number;
    name: string;
    email: string;
}
export declare class UserService {
    private readonly logger;
    private readonly ctx;
    private users;
    private idCounter;
    private readonly log;
    constructor(logger: LoggerService, ctx: LoggerContext);
    findAll(): User[];
    create(createUserDto: CreateUserInput): User;
    findUserById(id: number): User | undefined;
}
