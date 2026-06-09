"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Textarea } from "@/src/components/ui/textarea";
import { Save } from "lucide-react";

interface TokenSaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, details: string) => void;
  defaultName: string;
}

export default function TokenSaveModal({ isOpen, onClose, onSave, defaultName }: TokenSaveModalProps) {
  const [name, setName] = useState(defaultName);
  const [details, setDetails] = useState("");

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setName(defaultName);
      setDetails("");
    } else {
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim(), details.trim());
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#4F7FFA]/10 flex items-center justify-center">
              <Save className="w-4 h-4 text-[#4F7FFA]" />
            </div>
            <DialogTitle className="text-base">Save Token Projection</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="tp-name" className="text-xs text-gray-500">Name</Label>
            <Input id="tp-name" value={name} onChange={(e) => setName(e.target.value)}
              className="h-9 text-sm" autoFocus required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tp-details" className="text-xs text-gray-500">
              Notes <span className="text-gray-300">(optional)</span>
            </Label>
            <Textarea id="tp-details" value={details} onChange={(e) => setDetails(e.target.value)}
              placeholder="Strategy notes, assumptions..." className="text-sm resize-none h-20" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button type="submit" size="sm" className="bg-[#4F7FFA] hover:bg-blue-600 text-xs gap-1.5" disabled={!name.trim()}>
              <Save className="w-3.5 h-3.5" />
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
