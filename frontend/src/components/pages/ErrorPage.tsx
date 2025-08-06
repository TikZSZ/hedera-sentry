import React from 'react';
import { useRouteError } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const RouterErrorPage = () => {
  const error = useRouteError();
  console.error(error);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl font-bold">
            <AlertCircle className="mr-2 h-6 w-6 text-destructive" />
            Oops! Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error Details</AlertTitle>
            <AlertDescription>
              {/* @ts-ignore */}
              {error.statusText || error.message}
            </AlertDescription>
          </Alert>
          <p className="mb-4 text-muted-foreground">
            We apologize for the inconvenience. Please try again or contact support if the problem persists.
          </p>
          <div className="flex justify-end">
            <Button onClick={() => window.location.href = '/'}>
              Return to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RouterErrorPage;