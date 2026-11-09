import { Injectable } from '@nestjs/common';
import {
  AnchorChecker,
  ResolverAnchorType,
  ResolverSourceType,
  SourceResolver,
} from './source-resolver.port';

/** Where domain modules register their resolvers in `onModuleInit` (RAKHAL-493). Last registration wins. */
@Injectable()
export class SourceResolverRegistry {
  private readonly resolvers = new Map<ResolverSourceType, SourceResolver>();
  private readonly anchors = new Map<ResolverAnchorType, AnchorChecker>();

  register(resolver: SourceResolver): void {
    this.resolvers.set(resolver.sourceType, resolver);
  }

  registerAnchorChecker(checker: AnchorChecker): void {
    this.anchors.set(checker.anchorType, checker);
  }

  get(sourceType: ResolverSourceType): SourceResolver | undefined {
    return this.resolvers.get(sourceType);
  }

  getAnchorChecker(anchorType: ResolverAnchorType): AnchorChecker | undefined {
    return this.anchors.get(anchorType);
  }
}
