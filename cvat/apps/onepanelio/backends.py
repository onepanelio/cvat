from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

from cvat.apps.onepanelio.middleware import OnepanelCoreTokenAuthentication
from cvat.apps.onepanelio.models import MirrorOnepanelUser, OnepanelAuth

UserModel = get_user_model()

class OnepanelIORestBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        token_auth = OnepanelCoreTokenAuthentication()
        user_and_auth = token_auth.authenticate(request)
        if user_and_auth is None:
            return None
        return user_and_auth[0]

class OnepanelIOBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(UserModel.USERNAME_FIELD)
        #Check if the user submitted via login form
        if username is None and "username" in request.POST and "password" in request.POST:
            username = request.POST['username']
            password = request.POST['password']
        # If the post information is empty, we are trying to auto-login the user
        if username is None and password is None:
            # Check cookie credentials against onepanel auth
            token_auth = OnepanelCoreTokenAuthentication()
            user_and_auth = token_auth.authenticate(request)
            if user_and_auth is not None:
                # If cookie credentials are valid, ensure user exists in cvat
                MirrorOnepanelUser.create_user(request)
                username = OnepanelAuth.get_auth_username(request)
                password = OnepanelAuth.get_auth_token(request) 
        try:
            # To allow auto-login, we need to load and set the user.
            # If the cookie is empty or invalid credentials, present the login page.
            user = UserModel._default_manager.get_by_natural_key(username)
        except UserModel.DoesNotExist:
            return None
        else:
            if user.check_password(password) and self.user_can_authenticate(user):
                return user
