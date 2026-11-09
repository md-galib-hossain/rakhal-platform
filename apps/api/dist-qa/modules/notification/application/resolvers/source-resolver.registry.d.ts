import { AnchorChecker, ResolverAnchorType, ResolverSourceType, SourceResolver } from './source-resolver.port';
export declare class SourceResolverRegistry {
    private readonly resolvers;
    private readonly anchors;
    register(resolver: SourceResolver): void;
    registerAnchorChecker(checker: AnchorChecker): void;
    get(sourceType: ResolverSourceType): SourceResolver | undefined;
    getAnchorChecker(anchorType: ResolverAnchorType): AnchorChecker | undefined;
}
