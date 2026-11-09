import { CreateUserDto } from '../dto/create-user.dto';
import { UserService } from 'src/modules/user/application/services/user.service';
export declare class UserController {
    private readonly userService;
    constructor(userService: UserService);
    getUsers(): import("src/modules/user/application/services/user.service").User[];
    createUser(dto: CreateUserDto): import("src/modules/user/application/services/user.service").User;
}
