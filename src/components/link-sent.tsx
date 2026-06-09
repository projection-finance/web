"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import Link from "next/link";

const LinkSent = () => {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "your email";

  return (
    <div className="min-h-screen bg-[#F5F5FA] flex flex-col items-center pt-32">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <Image
            src="/image 1.png"
            alt="logo"
            width={36}
            height={41}
            className="mb-2"
          />
          <h2 className="text-xl font-semibold text-gray-900">Link Sent</h2>
        </div>

        <div className="items-center justify-center grid">
          <Card className="grid w-[500px] p-1">
            <CardHeader className="grid items-center justify-center">
              <CardTitle></CardTitle>
              <Image src="/Vector.svg" alt="icon" width={30} height={26} />
            </CardHeader>
            <CardContent className="grid items-center justify-center gap-5">
              <h1 className="text-center">We&apos;ve sent a link to</h1>
              <h1 className="text-center font-semibold text-[#5382E3]">
                {email}
              </h1>
              <h1 className="text-center">
                You should receive an email with a link to login to the app.
              </h1>
            </CardContent>
            <CardFooter className="flex justify-center"></CardFooter>
            <div className="grid gap-9">
              <div className="grid items-center justify-center gap-10">
                <Link href="/sign-in">
                  <Button
                    variant="ghost"
                    className="text-[#5382E3] font-semibold hover:bg-transparent"
                  >
                    Back to Sign In
                  </Button>
                </Link>
              </div>
            </div>
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

export default LinkSent;
