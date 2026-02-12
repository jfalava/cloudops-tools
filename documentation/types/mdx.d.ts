declare module "*.mdx" {
  const Component: React.ComponentType<{
    components?: typeof import("fumadocs-ui/mdx").default;
  }>;
  export default Component;
  export const metadata: Record<string, unknown> | undefined;
  export const title: string | undefined;
  export const description: string | undefined;
}
