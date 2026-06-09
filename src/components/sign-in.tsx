"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/src/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

const Login = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    await signIn("resend", { email, callbackUrl: "/" });
    setIsLoading(false);
  };

  return (
    <div className="">
      {/* Mobile: block sign-in */}
      <div className="md:hidden w-full max-w-sm px-4">
        <div className="flex flex-col items-center space-y-4 py-8">
          <Link href="/">
            <Image
              src="/favicon.svg"
              alt="logo"
              width={40}
              height={40}
              className="mb-2"
            />
          </Link>
          <svg className="w-12 h-12 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
          <h2 className="text-lg font-semibold text-[#303549] text-center">
            Desktop recommended
          </h2>
          <p className="text-sm text-gray-500 text-center leading-relaxed">
            Projection Finance is designed for desktop use. Projections, simulations and portfolio management require a larger screen for the best experience.
          </p>
          <p className="text-xs text-gray-400 text-center">
            Please open this page on your computer to sign in and access all features.
          </p>
          <Link href="/" className="text-sm text-[#5382E3] hover:underline mt-2">
            Back to home
          </Link>
        </div>
      </div>

      {/* Desktop: normal sign-in */}
      <div className="hidden md:block w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <Link href="/">
            <Image
              src="/favicon.svg"
              alt="logo"
              width={40}
              height={40}
              className="mb-2"
            />
          </Link>
          <h2 className="text-xl font-semibold text-gray-900">
            Sign-in to your account
          </h2>
        </div>

        <div className="items-center justify-center grid">
          <Card className="grid w-[500px] p-6">
            <CardHeader>
              <CardTitle></CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleEmailSignIn}>
                <div className="grid w-full items-center gap-4">
                  <div className="flex flex-col space-y-3">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col space-y-1.5">
                    <Button
                      type="submit"
                      className="bg-[#597DF3] opacity-70"
                      disabled={isLoading || !email}
                    >
                      {isLoading ? "Sending link..." : "Sign-in with Email"}
                    </Button>
                  </div>
                  <div className="grid items-center justify-center mt-5 mb-5">
                    <h1 className="text-[#25252E] font-normal text-sm">
                      Or continue with
                    </h1>
                  </div>
                </div>
              </form>
            </CardContent>
            <CardFooter className="flex justify-center gap-5">
              <Button
                className="bg-black w-full"
                onClick={() => signIn("github", { callbackUrl: "/" })}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
                  />
                </svg>
                GitHub
              </Button>
              <Button
                className="bg-[#5382E3] w-full"
                onClick={() => signIn("google", { callbackUrl: "/" })}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                  />
                </svg>
                <span>Google</span>
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="flex justify-center space-x-4 text-sm text-gray-500">
          <a href="/privacy" className="hover:text-gray-900">
            Privacy Policy
          </a>
          <a href="/terms" className="hover:text-gray-900">
            Terms of Use
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;
