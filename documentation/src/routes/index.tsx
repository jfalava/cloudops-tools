import { createFileRoute } from "@tanstack/react-router";

import { Footer, Header, Hero } from "@/components/landing";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="from-background to-muted/20 flex min-h-screen flex-col bg-gradient-to-b">
      <Header />
      <Hero />
      <Footer />
    </div>
  );
}
