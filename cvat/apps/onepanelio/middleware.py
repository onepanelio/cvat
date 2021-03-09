import os
from pprint import pprint

from allauth.account.views import login
from django.contrib import auth
from django.contrib.auth.middleware import MiddlewareMixin
from django.http import HttpResponseForbidden, HttpResponseRedirect
from django.shortcuts import redirect
from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication
from rest_framework import HTTP_HEADER_ENCODING, exceptions
from django.utils.six import text_type
from django.utils.translation import ugettext_lazy as _

from cvat.apps.onepanelio.models import OnepanelAuth, MirrorOnepanelUser

UserModel = get_user_model()


class OnepanelCoreTokenAuthentication(BaseAuthentication):

    def authenticate(self, request):
        # ONEPANEL_API_URL = https: // app.alex.onepanel.io / api
        api_url = os.getenv("ONEPANEL_API_URL", "")
        if not api_url:
            msg = _('ONEPANEL_API_URL cannot be empty.')
            raise exceptions.AuthenticationFailed(msg)

        # Django automatically upper-cases headers, converts "-" to "_", adds HTTP
        auth_header = request.META.get('HTTP_ONEPANEL_AUTH_TOKEN', b'')
        username_header = request.META.get('HTTP_ONEPANEL_USERNAME', b'')
        # Missing headers, check cookie values
        if auth_header is b'' or username_header is b'':
            username = OnepanelAuth.get_auth_username(request)
            password = OnepanelAuth.get_auth_token(request)
            # To reduce authentication executions, check if user is already there and authorized
            try:
                user = UserModel._default_manager.get_by_natural_key(username)
                if user.check_password(password):
                    return (user, None)
            except UserModel.DoesNotExist:
                user = None

            if not OnepanelAuth.validate_token(password, username, api_url):
                msg = _('onepanel-auth-token or onepanel-username is invalid.')
                raise exceptions.AuthenticationFailed(msg)
            else:
                try:
                    MirrorOnepanelUser.create_user(request, username=username, auth_token=password)
                    user = UserModel._default_manager.get_by_natural_key(username)
                except UserModel.DoesNotExist:
                    UserModel().set_password(password)
                return (user, None)
            return None
        elif isinstance(auth_header, text_type) and isinstance(username_header, text_type):
            auth_header = auth_header.encode(HTTP_HEADER_ENCODING)
            username_header = username_header.encode(HTTP_HEADER_ENCODING)
            if not OnepanelAuth.validate_token(auth_header.decode(), username_header.decode(), api_url):
                msg = _('onepanel-auth-token or onepanel-username is invalid.')
                raise exceptions.AuthenticationFailed(msg)
            else:
                try:
                    MirrorOnepanelUser.create_user(request, username=username_header.decode(), auth_token=auth_header.decode())
                    user = UserModel._default_manager.get_by_natural_key(username_header.decode())
                except UserModel.DoesNotExist:
                    UserModel().set_password(auth_header.decode())
                return (user, None)
        else:
            msg = _('onepanel-auth-token or onepanel-username is invalid.')
            raise exceptions.AuthenticationFailed(msg)



class AutomaticUserLoginMiddleware(MiddlewareMixin):
    def process_view(self, request, view_func, view_args, view_kwargs):
        if not AutomaticUserLoginMiddleware._is_user_authenticated(request):
            user = auth.authenticate(request) #Go through all backends and try to authenticate user
            if user is None:
                return HttpResponseForbidden("User not found.")

            request.user = user
            auth.login(request, user)

    @staticmethod
    def _is_user_authenticated(request):
        user = request.user
        return user and user.is_authenticated
