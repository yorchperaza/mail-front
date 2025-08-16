import React, { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { XCircleIcon, PhotoIcon } from '@heroicons/react/24/outline'
import Image from "next/image";

/**
 * Controlled profile step. All form state lives in the parent so that
 * “Next” **and** “Skip” both have access to the same payload.
 */
export type ProfileData = { fullName: string; file?: File }

interface Props {
    /** The current form values from the parent */
    fullName: string
    file?: File
    /** Push local edits back up to the parent */
    onChange: (data: ProfileData) => void
    /** Parent-supplied save handler */
    onSubmit: () => void
    loading?: boolean
}

export default function ProfileStep({ fullName, file, onChange, onSubmit, loading }: Props) {
    const [preview, setPreview] = useState<string | null>(null)

    // Update preview whenever the file changes
    useEffect(() => {
        if (!file) {
            setPreview(null)
            return
        }
        const url = URL.createObjectURL(file)
        setPreview(url)
        return () => URL.revokeObjectURL(url)
    }, [file])

    /* Dropzone configuration */
    const onDrop = useCallback((accepted: File[]) => {
        if (!accepted.length) return
        onChange({ fullName, file: accepted[0] })
    }, [fullName, onChange])

    const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
        onDrop,
        accept: { 'image/*': [] },
        maxFiles: 1,
    })

    /* Form submit simply calls the parent handler */
    async function submit(e: React.FormEvent) {
        e.preventDefault()
        await onSubmit()
    }

    /* Handlers for controlled inputs */
    function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
        onChange({ fullName: e.target.value, file })
    }

    return (
        <form onSubmit={submit} className="space-y-6">
            <header className="text-center">
                <h1 className="text-2xl font-bold">Step 1: Your Profile</h1>
                <p className="text-sm text-gray-600 mt-1">
                    Tell us who you are. You can add a photo now or later.
                </p>
            </header>

            {/* Full name */}
            <div>
                <label className="block text-sm font-medium mb-1">Full Name</label>
                <input
                    type="text"
                    required
                    value={fullName}
                    onChange={handleNameChange}
                    placeholder="John Doe"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
            </div>

            {/* Avatar upload */}
            <div>
                <label className="block text-sm font-medium mb-1">Avatar (optional)</label>
                <div
                    {...getRootProps()}
                    className={`relative flex items-center justify-center h-32 border-2 rounded-xl cursor-pointer transition-colors
            ${isDragActive ? 'border-blue-500 bg-blue-50' : isDragReject ? 'border-red-500 bg-red-50' : 'border-dashed border-gray-300 hover:border-gray-400 bg-white'}`}
                >
                    <input {...getInputProps()} />

                    {preview ? (
                        <>
                            <div className="relative h-full w-full">
                                <Image
                                    src={preview}
                                    alt="avatar preview"
                                    fill
                                    sizes="100vw"
                                    className="object-cover rounded-xl"
                                    unoptimized   // required for blob: URLs
                                />
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onChange({ fullName, file: undefined });
                                    }}
                                    className="absolute top-2 right-2 text-white bg-black/60 p-1 rounded-full hover:bg-black/80"
                                >
                                    <XCircleIcon className="h-5 w-5" />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-gray-600 space-y-2">
                            <PhotoIcon className="h-8 w-8 mx-auto text-gray-400" />
                            <p>{isDragActive ? 'Drop image to upload' : 'Drag & drop, or click to select'}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* CTA */}
            <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-blue-800 hover:bg-blue-900 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
                {loading ? 'Saving…' : 'Next: Company'}
            </button>
        </form>
    )
}