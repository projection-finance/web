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

interface SaveProjectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, details: string) => Promise<void>;
  defaultName: string;
  defaultDetails: string;
  isSaving: boolean;
}

export default function SaveProjectionModal({
  isOpen,
  onClose,
  onSave,
  defaultName,
  defaultDetails,
  isSaving,
}: SaveProjectionModalProps) {
  const [name, setName] = useState(defaultName);
  const [details, setDetails] = useState(defaultDetails);

  const handleOpenChange = (open: boolean) => {
    if (open) {
      setName(defaultName);
      setDetails(defaultDetails);
    } else {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSave(name.trim(), details.trim());
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#5382E3]/10 flex items-center justify-center">
              <Save className="w-4 h-4 text-[#5382E3]" />
            </div>
            <DialogTitle className="text-base">Save Projection</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label htmlFor="proj-name" className="text-xs text-gray-500">
              Name
            </Label>
            <Input
              id="proj-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-sm"
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="proj-details" className="text-xs text-gray-500">
              Notes <span className="text-gray-300">(optional)</span>
            </Label>
            <Textarea
              id="proj-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Strategy notes, assumptions..."
              className="text-sm resize-none h-20"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-[#5382E3] text-xs gap-1.5"
              disabled={isSaving || !name.trim()}
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
