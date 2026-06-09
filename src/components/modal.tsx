"use client";

import Image from "next/image";
import type React from "react";
import { useId, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: { title: string; description: string }) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
}

interface ProjectionData {
  title: string;
  description: string;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Yes",
  cancelText = "No",
}) => {
  const [showSecondModal, setShowSecondModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [formData, setFormData] = useState<ProjectionData>({
    title: "",
    description: "",
  });

  const titleId = useId();
  const descriptionId = useId();

  const handleClose = () => {
    setShowSecondModal(false);
    setShowFormModal(false);
    setFormData({ title: "", description: "" });
    onClose();
  };

  const handleConfirm = () => {
    setShowSecondModal(true);
  };

  const handleSecondConfirm = () => {
    setShowSecondModal(false);
    setShowFormModal(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(formData);
    handleClose();
  };

  if (typeof window === "undefined") {
    return null; // Return null on server-side
  }

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-50 transition-opacity duration-300 ${
        isOpen
          ? "opacity-100 backdrop-blur-[10px]"
          : "opacity-0 pointer-events-none backdrop-blur-none"
      }`}
    >
      {!showSecondModal && !showFormModal ? (
        <div className="bg-white rounded-2xl w-full max-w-md p-6 grid self-center items-center justify-center gap-2">
          <div className="flex justify-center">
            <Image
              src="/exclamation.svg"
              alt="warning"
              width={25}
              height={25}
            />
          </div>
          <h2 className="text-lg text-[#303549] font-medium mb-4 text-center">
            {title}
          </h2>
          <p className="text-gray-600 mb-4 text-center text-sm">
            {description}
          </p>
          <div className="flex justify-center gap-5">
            <Button
              className="bg-[#5382E3] hover:bg-blue-600 text-white w-44 rounded-md"
              onClick={handleConfirm}
              suppressHydrationWarning
            >
              {confirmText}
            </Button>
            <Button
              className="bg-white hover:bg-gray-300 text-black w-44 rounded-md mr-2 border"
              onClick={handleClose}
              suppressHydrationWarning
            >
              {cancelText}
            </Button>
          </div>
        </div>
      ) : showSecondModal ? (
        <div className="bg-white rounded-2xl w-full max-w-md p-6">
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <span className="text-gray-500 text-xl">!</span>
            </div>
          </div>
          <h2 className="text-lg font-medium text-center mb-2">
            Save the current projection?
          </h2>
          <p className="text-gray-600 text-center text-sm mb-4">
            Do you want to save the current state of the projection/simulation
            before reseting?
          </p>
          <div className="flex gap-3 px-4">
            <Button
              className="w-full bg-[#5382E3] hover:bg-blue-600 text-white py-3 rounded-md"
              onClick={handleSecondConfirm}
              suppressHydrationWarning
            >
              Yes
            </Button>
            <Button
              className="w-full bg-white hover:bg-gray-100 text-black py-3 rounded-md border"
              onClick={handleClose}
              suppressHydrationWarning
            >
              No
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl w-full max-w-md p-6">
          <h2 className="text-[#303549] text-lg flex justify-center items-center font-semibold mb-6">
            Add projection details
          </h2>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor={titleId} className="block text-sm text-gray-700">
                Title
              </label>
              <Input
                id={titleId}
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                className="w-full"
                required
                suppressHydrationWarning
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor={descriptionId}
                className="block text-sm text-gray-700"
              >
                Description
              </label>
              <Textarea
                id={descriptionId}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full min-h-[100px]"
                required
                suppressHydrationWarning
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                className="w-full bg-[#5382E3] hover:bg-blue-600 text-white py-3 rounded-md"
                suppressHydrationWarning
              >
                Save
              </Button>
              <Button
                type="button"
                className="w-full bg-white hover:bg-gray-100 text-black py-3 rounded-md border"
                onClick={handleClose}
                suppressHydrationWarning
              >
                No
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Modal;
